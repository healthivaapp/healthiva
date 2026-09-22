-- ============================================================================
-- HEALTHIVA (healthiva.in) - Migration 05: Staff Roles, Permissions & Scoping
-- Consolidated Architecture: Roles, Permissions, Invitations & Final RLS Policies
-- ============================================================================

-- 1. UNLOCK RLS SELECT POLICIES FOR CORE RBAC TABLES
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on roles" ON public.roles;
CREATE POLICY "Allow authenticated read on roles"
ON public.roles FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated read on permissions" ON public.permissions;
CREATE POLICY "Allow authenticated read on permissions"
ON public.permissions FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated read on role_permissions" ON public.role_permissions;
CREATE POLICY "Allow authenticated read on role_permissions"
ON public.role_permissions FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow anon read on roles" ON public.roles;
CREATE POLICY "Allow anon read on roles"
ON public.roles FOR SELECT TO anon
USING (true);

DROP POLICY IF EXISTS "Allow anon read on permissions" ON public.permissions;
CREATE POLICY "Allow anon read on permissions"
ON public.permissions FOR SELECT TO anon
USING (true);

DROP POLICY IF EXISTS "Allow anon read on role_permissions" ON public.role_permissions;
CREATE POLICY "Allow anon read on role_permissions"
ON public.role_permissions FOR SELECT TO anon
USING (true);

-- 2. ENSURE 4 SYSTEM ROLES ARE SEEDED (IDEMPOTENT)
INSERT INTO public.roles (id, name, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Owner', 'Doctor-owner or hospital admin with full operational & billing control'),
  ('22222222-2222-2222-2222-222222222222', 'Doctor', 'Consulting doctor: queue view, patient history, notes, sign prescriptions'),
  ('33333333-3333-3333-3333-333333333333', 'Receptionist', 'Front desk staff: patient registration, token generation, consultation billing'),
  ('44444444-4444-4444-4444-444444444444', 'Pharmacist', 'In-house pharmacy staff: view signed prescriptions, record dispensed items')
ON CONFLICT (name) DO UPDATE 
SET description = EXCLUDED.description;

-- 3. ENSURE 11 PERMISSION KEYS ARE SEEDED (IDEMPOTENT)
INSERT INTO public.permissions (id, code, description) VALUES
  ('a0111111-0000-0000-0000-000000000001', 'org.manage', 'Manage clinic settings, staff invites, and subscription'),
  ('a0111111-0000-0000-0000-000000000002', 'staff.manage', 'Invite and update staff roles and branch scopes'),
  ('a0111111-0000-0000-0000-000000000003', 'patient.register', 'Search and register new patients'),
  ('a0111111-0000-0000-0000-000000000004', 'queue.manage', 'Assign tokens and manage patient waiting queue'),
  ('a0111111-0000-0000-0000-000000000005', 'visit.read', 'View patient history and past consultation notes'),
  ('a0111111-0000-0000-0000-000000000006', 'visit.write', 'Write OPD visit notes and draft prescriptions'),
  ('a0111111-0000-0000-0000-000000000007', 'visits.sign', 'Sign prescriptions and lock medical notes'),
  ('a0111111-0000-0000-0000-000000000008', 'pharmacy.dispense', 'Dispense medicines and view counter inventory'),
  ('a0111111-0000-0000-0000-000000000009', 'billing.collect', 'Collect consultation fees and print receipts'),
  ('a0111111-0000-0000-0000-000000000010', 'billing.refund', 'Cancel invoices and issue billing adjustments'),
  ('a0111111-0000-0000-0000-000000000011', 'reports.read', 'View revenue summaries and practice analytics')
ON CONFLICT (code) DO UPDATE 
SET description = EXCLUDED.description;

-- 4. MAP DEFAULT SYSTEM ROLE PERMISSIONS
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '11111111-1111-1111-1111-111111111111', id FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '22222222-2222-2222-2222-222222222222', id FROM public.permissions 
WHERE code IN ('queue.manage', 'visit.read', 'visit.write', 'visits.sign', 'patient.register')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '33333333-3333-3333-3333-333333333333', id FROM public.permissions 
WHERE code IN ('patient.register', 'queue.manage', 'billing.collect', 'visit.read')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '44444444-4444-4444-4444-444444444444', id FROM public.permissions 
WHERE code IN ('pharmacy.dispense', 'visit.read')
ON CONFLICT DO NOTHING;

-- 5. EXTEND MEMBERSHIPS TABLE WITH PERMISSION MODES
ALTER TABLE public.memberships 
ADD COLUMN IF NOT EXISTS permission_mode VARCHAR(20) DEFAULT 'template' 
CHECK (permission_mode IN ('template', 'custom'));

ALTER TABLE public.memberships 
ADD COLUMN IF NOT EXISTS custom_permissions TEXT[] DEFAULT NULL;

-- 6. CREATE STAFF INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS public.staff_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    role_id UUID NOT NULL REFERENCES public.roles(id),
    branch_ids UUID[] DEFAULT NULL,
    doctor_reg_no VARCHAR(100) DEFAULT NULL,
    specialty VARCHAR(100) DEFAULT NULL,
    permission_mode VARCHAR(20) DEFAULT 'template' CHECK (permission_mode IN ('template', 'custom')),
    custom_permissions TEXT[] DEFAULT NULL,
    invite_token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_invitations_token ON public.staff_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_org_status ON public.staff_invitations(organization_id, status);

-- 7. HELPER FUNCTION: GET USER ORGANIZATION IDS
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT organization_id 
    FROM public.memberships 
    WHERE user_id = auth.uid() AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.get_user_organization_ids TO authenticated, service_role;

-- 8. ROW LEVEL SECURITY POLICIES (CONSOLIDATED & FINAL)

-- Staff Invitations RLS
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage staff invitations in their org" ON public.staff_invitations;
CREATE POLICY "Owners can manage staff invitations in their org"
ON public.staff_invitations FOR ALL TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids()))
WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

DROP POLICY IF EXISTS "Allow reading invitations by token" ON public.staff_invitations;
CREATE POLICY "Allow reading invitations by token"
ON public.staff_invitations FOR SELECT TO anon, authenticated
USING (status = 'pending' AND expires_at > NOW());

-- Memberships RLS
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own direct memberships" ON public.memberships;
DROP POLICY IF EXISTS "Users can view memberships in their organization" ON public.memberships;
CREATE POLICY "Users can view memberships in their organization"
ON public.memberships FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR organization_id IN (SELECT public.get_user_organization_ids())
);

DROP POLICY IF EXISTS "Users can update their own memberships" ON public.memberships;
DROP POLICY IF EXISTS "Owners can manage memberships in their organization" ON public.memberships;
CREATE POLICY "Owners can manage memberships in their organization"
ON public.memberships FOR ALL TO authenticated
USING (
    user_id = auth.uid()
    OR organization_id IN (SELECT public.get_user_organization_ids())
)
WITH CHECK (
    user_id = auth.uid()
    OR organization_id IN (SELECT public.get_user_organization_ids())
);

-- Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
CREATE POLICY "Users can view profiles in their organization"
ON public.profiles FOR SELECT TO authenticated
USING (
    id = auth.uid()
    OR is_platform_admin = TRUE
    OR id IN (
        SELECT user_id FROM public.memberships 
        WHERE organization_id IN (SELECT public.get_user_organization_ids())
    )
);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners can update profiles in their organization" ON public.profiles;
CREATE POLICY "Owners can update profiles in their organization"
ON public.profiles FOR UPDATE TO authenticated
USING (
    id = auth.uid()
    OR is_platform_admin = TRUE
    OR id IN (
        SELECT user_id FROM public.memberships 
        WHERE organization_id IN (SELECT public.get_user_organization_ids())
    )
)
WITH CHECK (
    id = auth.uid()
    OR is_platform_admin = TRUE
    OR id IN (
        SELECT user_id FROM public.memberships 
        WHERE organization_id IN (SELECT public.get_user_organization_ids())
    )
);

-- Membership Roles & Scopes RLS
ALTER TABLE public.membership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_clinic_scopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view membership_roles in their org" ON public.membership_roles;
DROP POLICY IF EXISTS "Members can manage membership_roles in their org" ON public.membership_roles;
CREATE POLICY "Members can manage membership_roles in their org"
ON public.membership_roles FOR ALL TO authenticated
USING (
    membership_id IN (
        SELECT id FROM public.memberships 
        WHERE user_id = auth.uid() 
           OR organization_id IN (SELECT public.get_user_organization_ids())
    )
)
WITH CHECK (
    membership_id IN (
        SELECT id FROM public.memberships 
        WHERE user_id = auth.uid() 
           OR organization_id IN (SELECT public.get_user_organization_ids())
    )
);

DROP POLICY IF EXISTS "Members can view and manage clinic scopes in their org" ON public.membership_clinic_scopes;
DROP POLICY IF EXISTS "Members can manage clinic scopes in their org" ON public.membership_clinic_scopes;
CREATE POLICY "Members can manage clinic scopes in their org"
ON public.membership_clinic_scopes FOR ALL TO authenticated
USING (
    membership_id IN (
        SELECT id FROM public.memberships 
        WHERE user_id = auth.uid() 
           OR organization_id IN (SELECT public.get_user_organization_ids())
    )
)
WITH CHECK (
    membership_id IN (
        SELECT id FROM public.memberships 
        WHERE user_id = auth.uid() 
           OR organization_id IN (SELECT public.get_user_organization_ids())
    )
);

-- 9. OWNER PROTECTION GUARDRAIL
-- Ensures clinic creators always retain the Owner role
INSERT INTO public.membership_roles (membership_id, role_id)
SELECT m.id, '11111111-1111-1111-1111-111111111111'::UUID
FROM public.memberships m
JOIN public.organizations o ON o.id = m.organization_id
WHERE m.created_at <= o.created_at + INTERVAL '10 seconds'
ON CONFLICT DO NOTHING;

-- 10. GET ORGANIZATION STAFF RPC (SECURITY DEFINER)
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
                'roleName', COALESCE(r.name, 'Doctor'),
                'roleId', COALESCE(r.id::text, ''),
                'status', COALESCE(m.status, 'active'),
                'permissionMode', COALESCE(m.permission_mode, 'template'),
                'customPermissions', m.custom_permissions,
                'assignedBranches', COALESCE(branches.branch_list, '[]'::jsonb),
                'createdAt', m.created_at,
                'isInvitation', FALSE
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
                'status', 'pending',
                'permissionMode', COALESCE(inv.permission_mode, 'template'),
                'customPermissions', inv.custom_permissions,
                'assignedBranches', COALESCE(inv_branches.branch_list, '[]'::jsonb),
                'createdAt', inv.created_at,
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
      AND inv.status = 'pending'
      AND inv.expires_at > NOW();

    RETURN jsonb_build_object(
        'success', TRUE,
        'activeStaff', v_members,
        'pendingInvitations', v_invitations
    );
END;
$$;

-- 11. UPDATE STAFF ACCESS RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.update_staff_access(
    p_membership_id UUID,
    p_organization_id UUID,
    p_branch_ids UUID[] DEFAULT NULL,
    p_permission_mode VARCHAR(20) DEFAULT NULL,
    p_custom_permissions TEXT[] DEFAULT NULL,
    p_status VARCHAR(50) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_branch_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.memberships 
        WHERE id = p_membership_id AND organization_id = p_organization_id
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Membership not found in this organization.');
    END IF;

    IF p_status IS NOT NULL THEN
        UPDATE public.memberships 
        SET status = p_status
        WHERE id = p_membership_id;
    END IF;

    IF p_permission_mode IS NOT NULL THEN
        UPDATE public.memberships
        SET permission_mode = p_permission_mode,
            custom_permissions = CASE 
                WHEN p_permission_mode = 'custom' THEN p_custom_permissions 
                ELSE NULL 
            END
        WHERE id = p_membership_id;
    END IF;

    IF p_branch_ids IS NOT NULL THEN
        DELETE FROM public.membership_clinic_scopes WHERE membership_id = p_membership_id;
        FOREACH v_branch_id IN ARRAY p_branch_ids
        LOOP
            INSERT INTO public.membership_clinic_scopes (membership_id, clinic_id)
            VALUES (p_membership_id, v_branch_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_staff TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_staff_access TO authenticated, service_role;
