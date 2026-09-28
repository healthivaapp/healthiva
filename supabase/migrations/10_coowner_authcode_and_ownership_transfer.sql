-- ============================================================================
-- HEALTHIVA - Migration 10: Co-Owner Authority, Invite Auth Code & Ownership Transfer
-- Foundation: Add org_authority & auth_code to staff_invitations,
-- refine owner projection guard for Co-Owner administration,
-- update accept_staff_invitation (preserving invite_token NOT NULL while purging auth_code),
-- update get_staff_invitation_details & get_organization_staff RPCs,
-- and add transfer_primary_ownership RPC.
-- ============================================================================

-- 1. ADD org_authority & auth_code TO staff_invitations
ALTER TABLE public.staff_invitations 
ADD COLUMN IF NOT EXISTS org_authority VARCHAR(20) DEFAULT 'none';

ALTER TABLE public.staff_invitations 
ADD COLUMN IF NOT EXISTS auth_code VARCHAR(10) DEFAULT NULL;

-- 2. REFINE TRIGGER: Guard Primary Owner Projection while permitting Co-Owner ('administrator') management
CREATE OR REPLACE FUNCTION public.fn_guard_membership_owner_projection()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_org_primary_owner UUID;
    v_jwt_role TEXT := current_setting('request.jwt.claim.role', true);
BEGIN
    -- Allow internal database trigger or RPC execution via session setting
    IF current_setting('healthiva.rbac_internal_sync', true) = 'on' THEN
        RETURN NEW;
    END IF;

    -- Always block direct tampering with is_primary_owner or 'primary_owner' authority
    IF (OLD.is_primary_owner IS DISTINCT FROM NEW.is_primary_owner) OR
       (OLD.org_authority = 'primary_owner' AND NEW.org_authority != 'primary_owner') OR
       (OLD.org_authority != 'primary_owner' AND NEW.org_authority = 'primary_owner') THEN
        RAISE EXCEPTION 'RBAC Security Violation: Direct modification of Primary Owner status is forbidden. Use transfer_organization_ownership().';
    END IF;

    -- For Co-Owner ('administrator' <-> 'none') changes, allow service_role or the organization Primary Owner
    IF OLD.org_authority IS DISTINCT FROM NEW.org_authority THEN
        IF v_jwt_role = 'service_role' OR current_user IN ('postgres', 'service_role') THEN
            RETURN NEW;
        END IF;

        SELECT primary_owner_user_id INTO v_org_primary_owner
        FROM public.organizations
        WHERE id = NEW.organization_id;

        IF v_org_primary_owner IS NOT NULL AND auth.uid() = v_org_primary_owner THEN
            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'RBAC Security Violation: Only the Primary Owner can grant or revoke Co-Owner (Administrator) authority.';
    END IF;

    RETURN NEW;
END;
$$;

-- 3. UPDATE get_staff_invitation_details RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_staff_invitation_details(p_token VARCHAR(255))
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_inv RECORD;
    v_org_name TEXT;
    v_logo_url TEXT;
    v_role_name TEXT;
    v_role_desc TEXT;
    v_branches TEXT[];
BEGIN
    SELECT * INTO v_inv
    FROM public.staff_invitations
    WHERE invite_token = p_token
      AND status = 'pending'
      AND expires_at > NOW()
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'This invitation link is invalid, expired, or has already been accepted.'
        );
    END IF;

    SELECT name INTO v_org_name
    FROM public.organizations
    WHERE id = v_inv.organization_id;

    SELECT (brand_json->>'logo_url') INTO v_logo_url
    FROM public.organization_settings
    WHERE organization_id = v_inv.organization_id;

    SELECT name, description INTO v_role_name, v_role_desc
    FROM public.roles
    WHERE id = v_inv.role_id;

    IF v_inv.branch_ids IS NOT NULL AND array_length(v_inv.branch_ids, 1) > 0 THEN
        SELECT ARRAY_AGG(name) INTO v_branches
        FROM public.clinics
        WHERE id = ANY(v_inv.branch_ids);
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'invitation', jsonb_build_object(
            'fullName', v_inv.full_name,
            'email', v_inv.email,
            'mobile', v_inv.mobile,
            'roleName', COALESCE(v_role_name, 'Doctor'),
            'roleDescription', COALESCE(v_role_desc, ''),
            'organizationName', COALESCE(v_org_name, 'Helix care'),
            'logoUrl', v_logo_url,
            'branches', COALESCE(v_branches, ARRAY[]::TEXT[]),
            'doctorRegNo', v_inv.doctor_reg_no,
            'specialty', v_inv.specialty,
            'expiresAt', v_inv.expires_at,
            'orgAuthority', COALESCE(v_inv.org_authority, 'none'),
            'requiresAuthCode', (v_inv.auth_code IS NOT NULL AND TRIM(v_inv.auth_code) != '')
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_invitation_details(VARCHAR) TO anon, authenticated, service_role;

-- 4. UPDATE accept_staff_invitation RPC (SECURITY DEFINER)
-- Drop legacy 2-parameter overload to avoid ambiguity
DROP FUNCTION IF EXISTS public.accept_staff_invitation(VARCHAR, UUID);

CREATE OR REPLACE FUNCTION public.accept_staff_invitation(
    p_invite_token VARCHAR(255),
    p_user_id UUID,
    p_auth_code VARCHAR(10) DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_inv RECORD;
    v_membership_id UUID;
    v_branch_id UUID;
    v_default_clinic UUID := NULL;
    v_target_authority VARCHAR(20);
BEGIN
    -- A. Fetch pending invitation
    SELECT * INTO v_inv
    FROM public.staff_invitations
    WHERE invite_token = p_invite_token 
      AND status = 'pending' 
      AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid, expired, or already accepted invitation link.');
    END IF;

    -- B. Verify auth_code if one was generated for this invitation
    IF v_inv.auth_code IS NOT NULL AND TRIM(v_inv.auth_code) != '' THEN
        IF p_auth_code IS NULL OR TRIM(p_auth_code) != TRIM(v_inv.auth_code) THEN
            RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid or missing 6-digit email verification code.');
        END IF;
    END IF;

    IF v_inv.branch_ids IS NOT NULL AND array_length(v_inv.branch_ids, 1) > 0 THEN
        v_default_clinic := v_inv.branch_ids[1];
    END IF;

    v_target_authority := COALESCE(v_inv.org_authority, 'none');
    IF v_target_authority != 'administrator' THEN
        v_target_authority := 'none';
    END IF;

    -- C. Auto-confirm email in auth.users
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = p_user_id;

    -- D. Sync user profile details (name, mobile, email, doctor_reg_no)
    INSERT INTO public.profiles (id, full_name, mobile, email, doctor_reg_no, is_platform_admin, created_at)
    VALUES (p_user_id, v_inv.full_name, v_inv.mobile, LOWER(TRIM(v_inv.email)), v_inv.doctor_reg_no, FALSE, NOW())
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        mobile = EXCLUDED.mobile,
        email = EXCLUDED.email,
        doctor_reg_no = COALESCE(EXCLUDED.doctor_reg_no, public.profiles.doctor_reg_no);

    -- E. Create or update membership with assigned default branch & org_authority
    PERFORM set_config('healthiva.rbac_internal_sync', 'on', true);

    INSERT INTO public.memberships (
        organization_id,
        user_id,
        status,
        org_authority,
        permission_mode,
        custom_permissions,
        default_clinic_id,
        joined_at,
        created_at
    )
    VALUES (
        v_inv.organization_id,
        p_user_id,
        'active',
        v_target_authority,
        COALESCE(v_inv.permission_mode, 'template'),
        v_inv.custom_permissions,
        v_default_clinic,
        NOW(),
        NOW()
    )
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET status = 'active',
        org_authority = CASE 
            WHEN public.memberships.is_primary_owner = TRUE THEN 'primary_owner'
            ELSE EXCLUDED.org_authority
        END,
        permission_mode = EXCLUDED.permission_mode,
        custom_permissions = EXCLUDED.custom_permissions,
        default_clinic_id = COALESCE(EXCLUDED.default_clinic_id, public.memberships.default_clinic_id)
    RETURNING id INTO v_membership_id;

    PERFORM set_config('healthiva.rbac_internal_sync', 'off', true);

    -- F. Assign role in membership_roles (protect owner role if already an owner)
    IF NOT EXISTS (
        SELECT 1 FROM public.membership_roles 
        WHERE membership_id = v_membership_id AND role_id = '11111111-1111-1111-1111-111111111111'
    ) THEN
        DELETE FROM public.membership_roles WHERE membership_id = v_membership_id;
        INSERT INTO public.membership_roles (membership_id, role_id)
        VALUES (v_membership_id, v_inv.role_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- G. Assign branch scopes in membership_clinic_scopes
    DELETE FROM public.membership_clinic_scopes WHERE membership_id = v_membership_id;
    IF v_inv.branch_ids IS NOT NULL THEN
        FOREACH v_branch_id IN ARRAY v_inv.branch_ids
        LOOP
            INSERT INTO public.membership_clinic_scopes (membership_id, clinic_id)
            VALUES (v_membership_id, v_branch_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- H. Mark invitation accepted and purge one-time auth_code (keep invite_token NOT NULL)
    UPDATE public.staff_invitations
    SET status = 'accepted',
        auth_code = NULL,
        updated_at = NOW()
    WHERE id = v_inv.id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'organization_id', v_inv.organization_id,
        'membership_id', v_membership_id,
        'org_authority', v_target_authority
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(VARCHAR, UUID, VARCHAR) TO anon, authenticated, service_role;

-- 5. UPDATE get_organization_staff RPC (Includes isPrimaryOwner, orgAuthority, doctorRegNo)
CREATE OR REPLACE FUNCTION public.get_organization_staff(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_members JSONB;
    v_invitations JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'membershipId', m.id,
                'userId', m.user_id,
                'fullName', COALESCE(p.full_name, 'Staff Member'),
                'email', COALESCE(p.email, ''),
                'mobile', COALESCE(p.mobile, ''),
                'doctorRegNo', COALESCE(p.doctor_reg_no, ''),
                'roleName', COALESCE(r.name, 'Doctor'),
                'roleId', COALESCE(r.id::text, ''),
                'isCustomRole', COALESCE(r.is_custom, FALSE),
                'canPrescribe', COALESCE(r.can_prescribe, FALSE),
                'status', COALESCE(m.status, 'active'),
                'permissionMode', COALESCE(m.permission_mode, 'template'),
                'customPermissions', m.custom_permissions,
                'defaultClinicId', COALESCE(m.default_clinic_id::text, ''),
                'assignedBranches', COALESCE(branches.branch_list, '[]'::jsonb),
                'createdAt', m.created_at,
                'isInvitation', FALSE,
                'isPrimaryOwner', COALESCE(m.is_primary_owner, FALSE),
                'orgAuthority', COALESCE(m.org_authority, CASE WHEN m.is_primary_owner THEN 'primary_owner' ELSE 'none' END),
                'isOwner', (COALESCE(m.is_primary_owner, FALSE) OR m.org_authority = 'administrator' OR LOWER(COALESCE(r.name, '')) = 'owner')
            )
            ORDER BY m.created_at ASC
        ),
        '[]'::jsonb
    ) INTO v_members
    FROM public.memberships m
    LEFT JOIN public.profiles p ON p.id = m.user_id
    LEFT JOIN public.membership_roles mr ON mr.membership_id = m.id
    LEFT JOIN public.roles r ON r.id = mr.role_id
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'code', c.code,
                'city', c.city
            )
        ) AS branch_list
        FROM public.membership_clinic_scopes mcs
        JOIN public.clinics c ON c.id = mcs.clinic_id
        WHERE mcs.membership_id = m.id
    ) branches ON TRUE
    WHERE m.organization_id = p_org_id;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'membershipId', inv.id,
                'invitationId', inv.id,
                'inviteToken', inv.invite_token,
                'fullName', inv.full_name,
                'email', inv.email,
                'mobile', inv.mobile,
                'roleName', COALESCE(r.name, 'Doctor'),
                'roleId', COALESCE(r.id::text, ''),
                'specialty', COALESCE(inv.specialty, ''),
                'status', 'pending',
                'permissionMode', COALESCE(inv.permission_mode, 'template'),
                'customPermissions', inv.custom_permissions,
                'orgAuthority', COALESCE(inv.org_authority, 'none'),
                'assignedBranches', COALESCE(inv_branches.branch_list, '[]'::jsonb),
                'createdAt', inv.created_at,
                'expiresAt', inv.expires_at,
                'isInvitation', TRUE
            )
            ORDER BY inv.created_at DESC
        ),
        '[]'::jsonb
    ) INTO v_invitations
    FROM public.staff_invitations inv
    LEFT JOIN public.roles r ON r.id = inv.role_id
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'code', c.code,
                'city', c.city
            )
        ) AS branch_list
        FROM public.clinics c
        WHERE c.id = ANY(inv.branch_ids)
    ) inv_branches ON TRUE
    WHERE inv.organization_id = p_org_id
      AND inv.status = 'pending';

    RETURN jsonb_build_object(
        'success', TRUE,
        'activeStaff', v_members,
        'pendingInvitations', v_invitations
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_staff(UUID) TO anon, authenticated, service_role;

-- 6. ATOMIC PRIMARY OWNERSHIP TRANSFER RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.transfer_primary_ownership(
    p_org_id UUID,
    p_initiator_user_id UUID,
    p_new_primary_owner_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_current_owner_id UUID;
    v_target_mem_id UUID;
    v_initiator_mem_id UUID;
BEGIN
    -- 1. Verify initiator is currently the Primary Owner
    SELECT primary_owner_user_id INTO v_current_owner_id
    FROM public.organizations
    WHERE id = p_org_id;

    IF v_current_owner_id IS NULL OR v_current_owner_id != p_initiator_user_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Unauthorized: Only the current Primary Owner can transfer ownership.');
    END IF;

    IF p_initiator_user_id = p_new_primary_owner_user_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'You are already the Primary Owner.');
    END IF;

    -- 2. Verify target user is an active member with administrator authority (Co-Owner)
    SELECT id INTO v_target_mem_id
    FROM public.memberships
    WHERE organization_id = p_org_id 
      AND user_id = p_new_primary_owner_user_id 
      AND status = 'active'
      AND org_authority = 'administrator';

    IF v_target_mem_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Ownership can only be transferred to an active Co-Owner (Administrator).');
    END IF;

    SELECT id INTO v_initiator_mem_id
    FROM public.memberships
    WHERE organization_id = p_org_id AND user_id = p_initiator_user_id;

    -- 3. Execute atomic handover
    PERFORM set_config('healthiva.rbac_internal_sync', 'on', true);

    -- A. Update organization primary owner reference
    UPDATE public.organizations
    SET primary_owner_user_id = p_new_primary_owner_user_id,
        updated_at = NOW()
    WHERE id = p_org_id;

    -- B. Promote target to primary owner
    UPDATE public.memberships
    SET is_primary_owner = TRUE,
        org_authority = 'primary_owner',
        updated_at = NOW()
    WHERE id = v_target_mem_id;

    -- C. Demote former primary owner to Co-Owner (Administrator)
    UPDATE public.memberships
    SET is_primary_owner = FALSE,
        org_authority = 'administrator',
        updated_at = NOW()
    WHERE id = v_initiator_mem_id;

    PERFORM set_config('healthiva.rbac_internal_sync', 'off', true);

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Primary ownership transferred successfully.',
        'new_primary_owner_user_id', p_new_primary_owner_user_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_primary_ownership(UUID, UUID, UUID) TO authenticated, service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
