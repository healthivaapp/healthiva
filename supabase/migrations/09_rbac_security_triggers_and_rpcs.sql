-- ============================================================================
-- HEALTHIVA - Migration 09: RBAC Security Triggers, Lock Semantics & Unified RPCs
-- Foundation: Bi-directional Owner Synchronization, Tamper Proofing,
-- Replacement Model Matrix, NMC Prescriber Protection, and Safe Handover
-- ============================================================================

-- 1. TRIGGER 1: Synchronize membership projection on membership change
CREATE OR REPLACE FUNCTION public.fn_sync_membership_primary_owner()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_primary_owner_id UUID;
BEGIN
    SELECT primary_owner_user_id INTO v_primary_owner_id
    FROM public.organizations
    WHERE id = NEW.organization_id;

    IF v_primary_owner_id IS NOT NULL AND NEW.user_id = v_primary_owner_id THEN
        NEW.is_primary_owner := TRUE;
        NEW.org_authority := 'primary_owner';
    ELSE
        IF NEW.is_primary_owner = TRUE AND (v_primary_owner_id IS NULL OR NEW.user_id != v_primary_owner_id) THEN
            NEW.is_primary_owner := FALSE;
            IF NEW.org_authority = 'primary_owner' THEN
                NEW.org_authority := 'none';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_membership_primary_owner ON public.memberships;
CREATE TRIGGER trg_sync_membership_primary_owner
BEFORE INSERT OR UPDATE OF organization_id, user_id ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_membership_primary_owner();

-- 2. TRIGGER 2: Guard membership owner projection against direct tampering
CREATE OR REPLACE FUNCTION public.fn_guard_membership_owner_projection()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- Allow internal database trigger or migration execution via session setting
    IF current_setting('healthiva.rbac_internal_sync', true) = 'on' THEN
        RETURN NEW;
    END IF;

    -- Block direct modification of is_primary_owner or org_authority
    IF (OLD.is_primary_owner IS DISTINCT FROM NEW.is_primary_owner) OR
       (OLD.org_authority IS DISTINCT FROM NEW.org_authority) THEN
        RAISE EXCEPTION 'RBAC Security Violation: Direct modification of is_primary_owner or org_authority is forbidden. Use transfer_organization_ownership() or approved authority RPCs.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_membership_owner_projection ON public.memberships;
CREATE TRIGGER trg_guard_membership_owner_projection
BEFORE UPDATE OF is_primary_owner, org_authority ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_membership_owner_projection();

-- 3. TRIGGER 3: Guard Primary Owner status against suspension, deactivation or deletion
CREATE OR REPLACE FUNCTION public.fn_guard_primary_owner_status()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- Allow internal database trigger or migration execution via session setting
    IF current_setting('healthiva.rbac_internal_sync', true) = 'on' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.is_primary_owner = TRUE THEN
            RAISE EXCEPTION 'RBAC Security Violation: Primary Owner membership cannot be deleted. Transfer organization ownership first.';
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.is_primary_owner = TRUE AND NEW.status != 'active' THEN
            RAISE EXCEPTION 'RBAC Security Violation: Primary Owner cannot be suspended or deactivated. Status must remain active.';
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_primary_owner_status ON public.memberships;
CREATE TRIGGER trg_guard_primary_owner_status
BEFORE UPDATE OF status OR DELETE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_primary_owner_status();

-- 4. TRIGGER 4: Synchronize memberships when organization primary owner is set or changed
CREATE OR REPLACE FUNCTION public.fn_sync_org_primary_owner()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF NEW.primary_owner_user_id IS NOT NULL AND 
       (OLD.primary_owner_user_id IS NULL OR OLD.primary_owner_user_id != NEW.primary_owner_user_id) THEN
        
        -- Set session variable so guard triggers permit the synchronization
        PERFORM set_config('healthiva.rbac_internal_sync', 'on', true);

        -- Demote old owner membership if exists to Administrator
        IF OLD.primary_owner_user_id IS NOT NULL THEN
            UPDATE public.memberships
            SET is_primary_owner = FALSE,
                org_authority = 'administrator'
            WHERE organization_id = NEW.id
              AND user_id = OLD.primary_owner_user_id;
        END IF;

        -- Promote new owner membership
        UPDATE public.memberships
        SET is_primary_owner = TRUE,
            org_authority = 'primary_owner',
            status = 'active'
        WHERE organization_id = NEW.id
          AND user_id = NEW.primary_owner_user_id;

        PERFORM set_config('healthiva.rbac_internal_sync', 'off', true);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_org_primary_owner ON public.organizations;
CREATE TRIGGER trg_sync_org_primary_owner
AFTER INSERT OR UPDATE OF primary_owner_user_id ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_org_primary_owner();

-- 5. FUNCTION: has_permission (Replacement Model + NMC Prescriber Protection)
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
    v_is_primary_owner BOOLEAN;
    v_org_authority VARCHAR(30);
    v_permission_mode VARCHAR(20);
    v_custom_perms TEXT[];
    v_role_id UUID;
    v_role_can_prescribe BOOLEAN;
    v_doctor_reg_no VARCHAR(100);
BEGIN
    -- 1. Fetch user membership, authority and assigned role
    SELECT m.id, m.is_primary_owner, m.org_authority, m.permission_mode, m.custom_permissions, 
           mr.role_id, COALESCE(r.can_prescribe, FALSE)
    INTO v_membership_id, v_is_primary_owner, v_org_authority, v_permission_mode, v_custom_perms,
         v_role_id, v_role_can_prescribe
    FROM public.memberships m
    LEFT JOIN public.membership_roles mr ON mr.membership_id = m.id
    LEFT JOIN public.roles r ON r.id = mr.role_id
    WHERE m.user_id = p_user_id 
      AND m.organization_id = p_org_id 
      AND m.status = 'active'
    LIMIT 1;

    IF v_membership_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Primary Owner has unconditional root access across all clinic domains
    IF v_is_primary_owner = TRUE THEN
        RETURN TRUE;
    END IF;

    -- 3. Medical Prescribing Invariant: visits.sign requires verified NMC registration
    IF p_permission_code = 'visits.sign' THEN
        IF v_role_can_prescribe IS NOT TRUE THEN
            RETURN FALSE;
        END IF;

        SELECT doctor_reg_no INTO v_doctor_reg_no
        FROM public.profiles
        WHERE id = p_user_id;

        IF v_doctor_reg_no IS NULL OR TRIM(v_doctor_reg_no) = '' THEN
            RETURN FALSE;
        END IF;

        -- Doctor with valid reg no can sign
        RETURN TRUE;
    END IF;

    -- 4. Co-Owners / Administrators hold full operational rights (excluding visits.sign handled above)
    IF v_org_authority = 'administrator' THEN
        RETURN TRUE;
    END IF;

    -- 5. Individual Custom Permissions Override
    IF v_permission_mode = 'custom' THEN
        RETURN (v_custom_perms IS NOT NULL AND p_permission_code = ANY(v_custom_perms));
    END IF;

    -- 6. Role Capabilities: Replacement Model
    -- If clinic customized this role in organization_role_permissions, that set COMPLETELY REPLACES factory defaults
    IF EXISTS (
        SELECT 1 FROM public.organization_role_permissions 
        WHERE organization_id = p_org_id AND role_id = v_role_id
    ) THEN
        RETURN EXISTS (
            SELECT 1 
            FROM public.organization_role_permissions orp
            JOIN public.permissions p ON p.id = orp.permission_id
            WHERE orp.organization_id = p_org_id 
              AND orp.role_id = v_role_id 
              AND p.code = p_permission_code
        );
    END IF;

    -- 7. Factory Default Fallback: System role permissions
    RETURN EXISTS (
        SELECT 1 
        FROM public.role_permissions rp
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = v_role_id 
          AND p.code = p_permission_code
    );
END;
$$;

-- 6. RPC: save_role_capabilities (Create/Update Custom Role + Manage Permissions)
CREATE OR REPLACE FUNCTION public.save_role_capabilities(
    p_org_id UUID,
    p_role_id UUID,
    p_role_name VARCHAR(100),
    p_description TEXT,
    p_icon VARCHAR(50),
    p_is_custom BOOLEAN,
    p_permission_codes TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_owner BOOLEAN;
    v_authority VARCHAR(30);
    v_target_role_id UUID := p_role_id;
    v_role_org_id UUID;
    v_clean_perms TEXT[] := COALESCE(p_permission_codes, ARRAY[]::TEXT[]);
    v_caller_perms TEXT[];
    v_perm_record RECORD;
BEGIN
    -- 1. Authorization: Verify caller is Owner or Administrator
    SELECT is_primary_owner, org_authority INTO v_is_owner, v_authority
    FROM public.memberships
    WHERE organization_id = p_org_id 
      AND user_id = v_caller_id 
      AND status = 'active';

    IF v_is_owner IS NOT TRUE AND v_authority != 'administrator' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Unauthorized: Only clinic Owners and Administrators can manage role capabilities.');
    END IF;

    -- 2. Delegation Boundary: org.manage can NEVER be delegated to operational roles
    IF 'org.manage' = ANY(v_clean_perms) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Security Policy Violation: org.manage is reserved for clinic authority and cannot be granted to operational roles.');
    END IF;

    -- 3. Delegation Ceiling: Administrator cannot delegate permissions they do not possess
    IF v_is_owner IS NOT TRUE AND v_authority = 'administrator' THEN
        -- Collect caller permissions
        SELECT ARRAY_AGG(p.code) INTO v_caller_perms
        FROM public.permissions p
        WHERE public.has_permission(v_caller_id, p_org_id, p.code) = TRUE;

        IF NOT (v_clean_perms <@ COALESCE(v_caller_perms, ARRAY[]::TEXT[])) THEN
            RETURN jsonb_build_object('success', FALSE, 'error', 'Privilege Escalation Blocked: You cannot delegate permissions beyond your own active permissions.');
        END IF;
    END IF;

    -- 4. Cross-Tenant & System Role Integrity Check
    IF v_target_role_id IS NOT NULL THEN
        SELECT organization_id, is_custom INTO v_role_org_id, p_is_custom
        FROM public.roles
        WHERE id = v_target_role_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', FALSE, 'error', 'Target role not found.');
        END IF;

        IF v_role_org_id IS NOT NULL AND v_role_org_id != p_org_id THEN
            RETURN jsonb_build_object('success', FALSE, 'error', 'Cross-tenant security violation: Role belongs to another clinic organization.');
        END IF;
    END IF;

    -- 5. Medical Prescribing Invariant for Custom Roles
    IF p_is_custom = TRUE THEN
        -- Custom roles cannot hold visits.sign
        v_clean_perms := array_remove(v_clean_perms, 'visits.sign');

        IF v_target_role_id IS NULL THEN
            -- Insert new custom role
            INSERT INTO public.roles (name, description, icon, organization_id, is_custom, can_prescribe)
            VALUES (TRIM(p_role_name), p_description, COALESCE(p_icon, 'shield'), p_org_id, TRUE, FALSE)
            RETURNING id INTO v_target_role_id;
        ELSE
            -- Update existing custom role metadata
            UPDATE public.roles
            SET name = TRIM(p_role_name),
                description = p_description,
                icon = COALESCE(p_icon, icon)
            WHERE id = v_target_role_id AND organization_id = p_org_id;
        END IF;
    END IF;

    -- 6. Apply Replacement Model: Replace clinic role permissions
    DELETE FROM public.organization_role_permissions
    WHERE organization_id = p_org_id AND role_id = v_target_role_id;

    IF array_length(v_clean_perms, 1) > 0 THEN
        FOR v_perm_record IN
            SELECT id FROM public.permissions WHERE code = ANY(v_clean_perms)
        LOOP
            INSERT INTO public.organization_role_permissions (organization_id, role_id, permission_id)
            VALUES (p_org_id, v_target_role_id, v_perm_record.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'role_id', v_target_role_id,
        'permission_count', array_length(v_clean_perms, 1)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

-- 7. RPC: delete_custom_role (Safe Custom Role Deletion with Dependency Checks)
CREATE OR REPLACE FUNCTION public.delete_custom_role(
    p_org_id UUID,
    p_role_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_owner BOOLEAN;
    v_authority VARCHAR(30);
    v_role_org_id UUID;
    v_is_custom BOOLEAN;
    v_assigned_count INT := 0;
    v_invite_count INT := 0;
BEGIN
    -- 1. Authorization Check
    SELECT is_primary_owner, org_authority INTO v_is_owner, v_authority
    FROM public.memberships
    WHERE organization_id = p_org_id 
      AND user_id = v_caller_id 
      AND status = 'active';

    IF v_is_owner IS NOT TRUE AND v_authority != 'administrator' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Unauthorized: Only clinic Owners and Administrators can delete roles.');
    END IF;

    -- 2. Verify target role exists, is custom, and belongs to caller org
    SELECT organization_id, is_custom INTO v_role_org_id, v_is_custom
    FROM public.roles
    WHERE id = p_role_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Role not found.');
    END IF;

    IF v_is_custom IS NOT TRUE THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'System roles cannot be deleted.');
    END IF;

    IF v_role_org_id != p_org_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Cross-tenant security violation: Role belongs to another organization.');
    END IF;

    -- 3. Check active/suspended staff assignments
    SELECT COUNT(*) INTO v_assigned_count
    FROM public.membership_roles mr
    JOIN public.memberships m ON m.id = mr.membership_id
    WHERE mr.role_id = p_role_id 
      AND m.organization_id = p_org_id;

    IF v_assigned_count > 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', format('Cannot delete role: Currently assigned to %s active/suspended staff member(s). Reassign their roles first.', v_assigned_count)
        );
    END IF;

    -- 4. Check pending invitations referencing this role
    SELECT COUNT(*) INTO v_invite_count
    FROM public.staff_invitations
    WHERE organization_id = p_org_id 
      AND role_id = p_role_id 
      AND status = 'pending';

    IF v_invite_count > 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', format('Cannot delete role: Referenced by %s pending invitation(s). Cancel or update the invitations first.', v_invite_count)
        );
    END IF;

    -- 5. Safe cascade deletion of clinic overrides and custom role row
    DELETE FROM public.organization_role_permissions 
    WHERE organization_id = p_org_id AND role_id = p_role_id;

    DELETE FROM public.roles 
    WHERE id = p_role_id AND organization_id = p_org_id;

    RETURN jsonb_build_object('success', TRUE);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

-- 8. RPC: remove_staff_member (Overloaded to support both p_membership_id and p_user_id with Primary Owner Protection)
CREATE OR REPLACE FUNCTION public.remove_staff_member(
    p_membership_id UUID,
    p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_primary_owner BOOLEAN;
    v_profile_email VARCHAR(255);
    v_other_count INT := 0;
    v_deleted_profile BOOLEAN := FALSE;
    v_deleted_auth BOOLEAN := FALSE;
BEGIN
    -- Fetch target membership user_id and primary owner status
    SELECT user_id, is_primary_owner INTO v_user_id, v_is_primary_owner
    FROM public.memberships
    WHERE id = p_membership_id AND organization_id = p_org_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Staff membership not found or does not belong to this clinic organization.');
    END IF;

    -- IMMUNITY: Primary Owner cannot be removed
    IF v_is_primary_owner = TRUE THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Primary Owner cannot be removed from the organization. Transfer organization ownership first.');
    END IF;

    -- Fetch email from profile for invitations cleanup
    SELECT email INTO v_profile_email
    FROM public.profiles
    WHERE id = v_user_id;

    -- Delete child scopes and roles
    DELETE FROM public.membership_clinic_scopes WHERE membership_id = p_membership_id;
    DELETE FROM public.membership_roles WHERE membership_id = p_membership_id;

    -- Delete membership record
    DELETE FROM public.memberships WHERE id = p_membership_id AND organization_id = p_org_id;

    -- Delete matching invitations
    IF v_profile_email IS NOT NULL AND v_profile_email <> '' THEN
        DELETE FROM public.staff_invitations 
        WHERE organization_id = p_org_id 
          AND LOWER(email) = LOWER(v_profile_email);
    END IF;

    -- Check if user belongs to any other active memberships across any clinic organization
    SELECT COUNT(*) INTO v_other_count
    FROM public.memberships
    WHERE user_id = v_user_id;

    -- If no other memberships exist, delete profile and auth
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

-- 9. RPC: transfer_organization_ownership (Row-Locked Atomic Handover)
CREATE OR REPLACE FUNCTION public.transfer_organization_ownership(
    p_org_id UUID,
    p_new_owner_user_id UUID,
    p_confirmed_org_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_org RECORD;
    v_new_owner_mem RECORD;
BEGIN
    -- 1. Row-lock organization record to prevent concurrent ownership handovers
    SELECT id, name, primary_owner_user_id INTO v_org
    FROM public.organizations
    WHERE id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Clinic organization not found.');
    END IF;

    -- 2. Verify caller is current Primary Owner
    IF v_org.primary_owner_user_id != v_caller_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Unauthorized: Only the current Primary Owner can transfer clinic ownership.');
    END IF;

    -- 3. Safety Name Confirmation
    IF TRIM(LOWER(v_org.name)) != TRIM(LOWER(p_confirmed_org_name)) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Organization name confirmation does not match.');
    END IF;

    -- 4. Verify candidate new owner is an active member
    SELECT id, status, org_authority INTO v_new_owner_mem
    FROM public.memberships
    WHERE organization_id = p_org_id 
      AND user_id = p_new_owner_user_id;

    IF NOT FOUND OR v_new_owner_mem.status != 'active' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Target user must be an active member of this clinic organization.');
    END IF;

    IF p_new_owner_user_id = v_caller_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'You are already the Primary Owner.');
    END IF;

    -- 5. Audit Log Entry (using target_id and target_type = 'user')
    INSERT INTO public.rbac_audit_logs (
        organization_id,
        actor_user_id,
        action,
        target_id,
        target_type,
        old_state,
        new_state
    ) VALUES (
        p_org_id,
        v_caller_id,
        'transfer_primary_ownership',
        p_new_owner_user_id,
        'user',
        jsonb_build_object('primary_owner_user_id', v_org.primary_owner_user_id),
        jsonb_build_object('primary_owner_user_id', p_new_owner_user_id)
    );

    -- 6. Atomic update of organizations.primary_owner_user_id
    -- The trg_sync_org_primary_owner trigger will automatically demote old owner to 'administrator'
    -- and promote new owner to 'primary_owner' with internal sync credentials
    UPDATE public.organizations
    SET primary_owner_user_id = p_new_owner_user_id,
        updated_at = NOW()
    WHERE id = p_org_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'previous_owner_id', v_org.primary_owner_user_id,
        'new_owner_id', p_new_owner_user_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

-- 10. RPC: get_organization_roles (Unified System + Custom Roles with Effective Permissions)
CREATE OR REPLACE FUNCTION public.get_organization_roles(
    p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_roles JSONB;
BEGIN
    SELECT jsonb_agg(role_obj) INTO v_roles
    FROM (
        SELECT jsonb_build_object(
            'id', r.id,
            'name', r.name,
            'description', r.description,
            'icon', COALESCE(r.icon, 'shield'),
            'is_custom', COALESCE(r.is_custom, FALSE),
            'can_prescribe', COALESCE(r.can_prescribe, FALSE),
            'organization_id', r.organization_id,
            'permissions', COALESCE(
                -- If clinic customized this role, use organization_role_permissions
                (
                    SELECT jsonb_agg(p.code)
                    FROM public.organization_role_permissions orp
                    JOIN public.permissions p ON p.id = orp.permission_id
                    WHERE orp.organization_id = p_org_id AND orp.role_id = r.id
                ),
                -- Otherwise use factory defaults from role_permissions
                (
                    SELECT jsonb_agg(p.code)
                    FROM public.role_permissions rp
                    JOIN public.permissions p ON p.id = rp.permission_id
                    WHERE rp.role_id = r.id
                ),
                '[]'::jsonb
            )
        ) AS role_obj
        FROM public.roles r
        WHERE (r.organization_id IS NULL OR r.organization_id = p_org_id)
          AND LOWER(TRIM(r.name)) != 'owner'
        ORDER BY r.is_custom ASC, r.name ASC
    ) sub;

    RETURN COALESCE(v_roles, '[]'::jsonb);
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.has_permission TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_role_capabilities TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_custom_role TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_staff_member TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_organization_ownership TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_organization_roles TO authenticated, service_role;
