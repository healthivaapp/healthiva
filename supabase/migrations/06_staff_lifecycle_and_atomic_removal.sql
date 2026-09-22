-- ============================================================================
-- HEALTHIVA (healthiva.in) - Migration 06: Staff Lifecycle & Atomic Removal
-- Consolidated: Default Branch Scoping, Email Confirmation, Invitation Acceptance, and Atomic Staff Removal
-- ============================================================================

-- 1. ADD default_clinic_id COLUMN TO public.memberships
ALTER TABLE public.memberships 
ADD COLUMN IF NOT EXISTS default_clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_default_clinic ON public.memberships(default_clinic_id);

-- 2. DROP PREVIOUS OVERLOADED FUNCTION VARIATIONS TO PREVENT SIGNATURE CONFLICTS
DROP FUNCTION IF EXISTS public.accept_staff_invitation(VARCHAR, UUID);
DROP FUNCTION IF EXISTS public.accept_staff_invitation(TEXT, UUID);
DROP FUNCTION IF EXISTS public.accept_staff_invitation(VARCHAR, UUID, VARCHAR);
DROP FUNCTION IF EXISTS public.accept_staff_invitation(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.accept_staff_invitation(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.confirm_staff_user_email(UUID);
DROP FUNCTION IF EXISTS public.remove_staff_member(UUID, UUID);

-- 3. HELPER FUNCTION: CONFIRM STAFF EMAIL IN auth.users
CREATE OR REPLACE FUNCTION public.confirm_staff_user_email(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_staff_user_email TO anon, authenticated, service_role;

-- 4. ACCEPT STAFF INVITATION RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.accept_staff_invitation(
    p_invite_token VARCHAR(255),
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_inv RECORD;
    v_membership_id UUID;
    v_branch_id UUID;
    v_default_clinic UUID := NULL;
BEGIN
    -- A. Fetch pending invitation
    SELECT * INTO v_inv
    FROM public.staff_invitations
    WHERE invite_token = p_invite_token AND status = 'pending' AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid, expired, or already accepted invitation link.');
    END IF;

    IF v_inv.branch_ids IS NOT NULL AND array_length(v_inv.branch_ids, 1) > 0 THEN
        v_default_clinic := v_inv.branch_ids[1];
    END IF;

    -- B. Auto-confirm email in auth.users
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = p_user_id;

    -- C. Sync user profile details (name, mobile, email)
    INSERT INTO public.profiles (id, full_name, mobile, email, is_platform_admin, created_at)
    VALUES (p_user_id, v_inv.full_name, v_inv.mobile, v_inv.email, FALSE, NOW())
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        mobile = EXCLUDED.mobile,
        email = EXCLUDED.email;

    -- D. Create or update membership with assigned default branch
    INSERT INTO public.memberships (
        organization_id,
        user_id,
        status,
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
        COALESCE(v_inv.permission_mode, 'template'),
        v_inv.custom_permissions,
        v_default_clinic,
        NOW(),
        NOW()
    )
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET status = 'active',
        permission_mode = EXCLUDED.permission_mode,
        custom_permissions = EXCLUDED.custom_permissions,
        default_clinic_id = COALESCE(EXCLUDED.default_clinic_id, public.memberships.default_clinic_id)
    RETURNING id INTO v_membership_id;

    -- E. Assign role in membership_roles (protect owner role if already an owner)
    IF NOT EXISTS (
        SELECT 1 FROM public.membership_roles 
        WHERE membership_id = v_membership_id AND role_id = '11111111-1111-1111-1111-111111111111'
    ) THEN
        DELETE FROM public.membership_roles WHERE membership_id = v_membership_id;
        INSERT INTO public.membership_roles (membership_id, role_id)
        VALUES (v_membership_id, v_inv.role_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- F. Assign branch scopes in membership_clinic_scopes
    DELETE FROM public.membership_clinic_scopes WHERE membership_id = v_membership_id;
    IF v_inv.branch_ids IS NOT NULL THEN
        FOREACH v_branch_id IN ARRAY v_inv.branch_ids
        LOOP
            INSERT INTO public.membership_clinic_scopes (membership_id, clinic_id)
            VALUES (v_membership_id, v_branch_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- G. Mark invitation accepted
    UPDATE public.staff_invitations
    SET status = 'accepted', updated_at = NOW()
    WHERE id = v_inv.id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'organization_id', v_inv.organization_id,
        'membership_id', v_membership_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_staff_invitation TO anon, authenticated, service_role;

-- 5. ATOMIC STAFF REMOVAL RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.remove_staff_member(
    p_membership_id UUID,
    p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_profile_email VARCHAR(255);
    v_other_count INT := 0;
    v_deleted_profile BOOLEAN := FALSE;
    v_deleted_auth BOOLEAN := FALSE;
BEGIN
    -- A. Fetch target membership user_id
    SELECT user_id INTO v_user_id
    FROM public.memberships
    WHERE id = p_membership_id AND organization_id = p_org_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Staff membership not found or does not belong to this clinic organization.');
    END IF;

    -- B. Fetch email from profile for invitations cleanup
    SELECT email INTO v_profile_email
    FROM public.profiles
    WHERE id = v_user_id;

    -- C. Delete child scopes and roles
    DELETE FROM public.membership_clinic_scopes WHERE membership_id = p_membership_id;
    DELETE FROM public.membership_roles WHERE membership_id = p_membership_id;

    -- D. Delete membership record
    DELETE FROM public.memberships WHERE id = p_membership_id AND organization_id = p_org_id;

    -- E. Delete matching pending/accepted staff invitations for this org
    IF v_profile_email IS NOT NULL AND v_profile_email <> '' THEN
        DELETE FROM public.staff_invitations 
        WHERE organization_id = p_org_id 
          AND LOWER(email) = LOWER(v_profile_email);
    END IF;

    -- F. Check if user belongs to any other active memberships across any clinic organization
    SELECT COUNT(*) INTO v_other_count
    FROM public.memberships
    WHERE user_id = v_user_id;

    -- G. If no other memberships exist, delete profile and permanently delete from auth.users
    IF v_other_count = 0 THEN
        DELETE FROM public.profiles WHERE id = v_user_id;
        v_deleted_profile := TRUE;

        BEGIN
            DELETE FROM auth.users WHERE id = v_user_id;
            v_deleted_auth := TRUE;
        EXCEPTION WHEN OTHERS THEN
            v_deleted_auth := FALSE;
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'user_id', v_user_id,
        'deleted_profile', v_deleted_profile,
        'deleted_auth', v_deleted_auth,
        'has_other_orgs', (v_other_count > 0)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_staff_member TO authenticated, service_role;

-- 6. PERMISSION EVALUATION RPC (SECURITY DEFINER)
-- Implements Healthiva Staff Scoping & RBAC Blueprint Section 3.2
CREATE OR REPLACE FUNCTION public.has_permission(
    p_user_id UUID,
    p_org_id UUID,
    p_permission_code TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_membership_id UUID;
    v_role_id UUID;
    v_permission_mode VARCHAR(20);
    v_custom_perms TEXT[];
    v_role_name VARCHAR(100);
BEGIN
    -- 1. Fetch user's active membership in this organization
    SELECT m.id, m.permission_mode, m.custom_permissions, mr.role_id, r.name
    INTO v_membership_id, v_permission_mode, v_custom_perms, v_role_id, v_role_name
    FROM public.memberships m
    LEFT JOIN public.membership_roles mr ON mr.membership_id = m.id
    LEFT JOIN public.roles r ON r.id = mr.role_id
    WHERE m.user_id = p_user_id 
      AND m.organization_id = p_org_id 
      AND m.status = 'active'
    LIMIT 1;

    -- If no active membership found, deny access
    IF v_membership_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Owner has root access (all permissions granted)
    IF v_role_id = '11111111-1111-1111-1111-111111111111'::UUID OR LOWER(v_role_name) = 'owner' THEN
        RETURN TRUE;
    END IF;

    -- 3. Custom Permission Mode: Evaluate staff member's custom overrides
    IF v_permission_mode = 'custom' THEN
        RETURN (v_custom_perms IS NOT NULL AND p_permission_code = ANY(v_custom_perms));
    END IF;

    -- 4. Template Mode: Check clinic role overrides first, then system role_permissions
    DECLARE
        v_role_overrides JSONB;
        v_role_codes JSONB;
    BEGIN
        SELECT workflow_json->'role_overrides' INTO v_role_overrides
        FROM public.organization_settings
        WHERE organization_id = p_org_id;

        IF v_role_overrides IS NOT NULL THEN
            v_role_codes := COALESCE(v_role_overrides->v_role_name, v_role_overrides->LOWER(v_role_name));
            IF v_role_codes IS NOT NULL AND jsonb_typeof(v_role_codes) = 'array' THEN
                RETURN (v_role_codes ? p_permission_code);
            END IF;
        END IF;
    END;

    -- Fallback to standard role_permissions dictionary
    RETURN EXISTS (
        SELECT 1 
        FROM public.role_permissions rp
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = v_role_id 
          AND p.code = p_permission_code
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_permission TO anon, authenticated, service_role;
