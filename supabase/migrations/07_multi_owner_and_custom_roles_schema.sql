-- ============================================================================
-- HEALTHIVA - Migration 07: Multi-Owner & Dynamic Custom Roles Schema
-- Foundation: Non-breaking schema extensions for Multi-Owner Governance,
-- Custom Roles Scoping, and NMC Prescriber Compliance
-- ============================================================================

-- 1. Extend organizations with nullable primary_owner_user_id initially
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS primary_owner_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT;

-- 2. Extend memberships with projection flag and authority level
ALTER TABLE public.memberships 
  ADD COLUMN IF NOT EXISTS is_primary_owner BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS org_authority VARCHAR(30) NOT NULL DEFAULT 'none' 
    CHECK (org_authority IN ('primary_owner', 'administrator', 'none'));

CREATE INDEX IF NOT EXISTS idx_memberships_org_authority 
  ON public.memberships (organization_id, org_authority);

CREATE UNIQUE INDEX IF NOT EXISTS uq_memberships_single_primary_owner 
  ON public.memberships (organization_id) WHERE (is_primary_owner = TRUE);

-- 3. Extend profiles with doctor_reg_no for NMC compliance
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS doctor_reg_no VARCHAR(100);

-- 4. Extend public.roles with organization ownership, custom flag, and prescribing capability
ALTER TABLE public.roles 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'shield',
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_prescribe BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark system Doctor role as medical prescriber
UPDATE public.roles 
SET can_prescribe = TRUE 
WHERE id = '22222222-2222-2222-2222-222222222222';

-- 5. Replace global unique role name with organization-scoped index
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_org_scoped_name 
ON public.roles (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(TRIM(name)));

-- 6. Relational Single Source of Truth for system and custom role capabilities
CREATE TABLE IF NOT EXISTS public.organization_role_permissions (
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (organization_id, role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_org_role_perms_lookup 
ON public.organization_role_permissions (organization_id, role_id);

-- Enable RLS on organization_role_permissions
ALTER TABLE public.organization_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view role permissions" ON public.organization_role_permissions;
CREATE POLICY "Org members can view role permissions"
ON public.organization_role_permissions FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

DROP POLICY IF EXISTS "Admins can manage organization role permissions" ON public.organization_role_permissions;
CREATE POLICY "Admins can manage organization role permissions"
ON public.organization_role_permissions FOR ALL
USING (
    organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE user_id = auth.uid() 
          AND status = 'active'
          AND (is_primary_owner = TRUE OR org_authority = 'administrator')
    )
);

-- 7. Audit log table for ownership and permission governance
CREATE TABLE IF NOT EXISTS public.rbac_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    target_id UUID,
    target_type VARCHAR(50),
    old_state JSONB,
    new_state JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rbac_audit_org_created 
ON public.rbac_audit_logs (organization_id, created_at DESC);

ALTER TABLE public.rbac_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read rbac audit logs" ON public.rbac_audit_logs;
CREATE POLICY "Admins can read rbac audit logs"
ON public.rbac_audit_logs FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE user_id = auth.uid() 
          AND status = 'active'
          AND (is_primary_owner = TRUE OR org_authority = 'administrator')
    )
);
