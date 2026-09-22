-- ============================================================================
-- HEALTHIVA - Migration 08: Data Normalization, Demo Isolation & Owner Invariant
-- Foundation: Explicit Verified Founder Mapping, Demo Isolation, and
-- Zero-Tolerance RBAC Invariant Assertion
-- ============================================================================

-- 1. Explicit verified clinic founders mapping table
CREATE TEMP TABLE IF NOT EXISTS _verified_clinic_founders (
    organization_id UUID PRIMARY KEY,
    primary_owner_user_id UUID NOT NULL,
    founder_name TEXT
);

TRUNCATE TABLE _verified_clinic_founders;

-- Verified founder for active production clinic: Helix care
INSERT INTO _verified_clinic_founders (organization_id, primary_owner_user_id, founder_name)
VALUES (
    'c2531bc8-cd5b-4b26-96ea-a6ae70b4a647'::uuid,
    '7133ecca-2de7-4307-89a6-e48430a439e9'::uuid,
    'Mohit vora'
);

-- 2. Mark zero-member demo orgs as 'demo_inactive'
UPDATE public.organizations
SET status = 'demo_inactive',
    updated_at = NOW()
WHERE id NOT IN (SELECT organization_id FROM public.memberships)
  AND status = 'active';

-- 3. Assert no active organization is unmapped
DO $$
DECLARE
    v_unmapped_org RECORD;
BEGIN
    FOR v_unmapped_org IN
        SELECT o.id, o.name
        FROM public.organizations o
        WHERE o.status = 'active'
          AND o.id NOT IN (SELECT organization_id FROM _verified_clinic_founders)
    LOOP
        RAISE EXCEPTION 'Migration 08 Aborted: Active organization "%" (%) lacks a verified founder mapping.',
            v_unmapped_org.name, v_unmapped_org.id;
    END LOOP;
END;
$$;

-- 4. Apply Primary Owner to organizations from verified mapping
UPDATE public.organizations o
SET primary_owner_user_id = v.primary_owner_user_id,
    updated_at = NOW()
FROM _verified_clinic_founders v
WHERE o.id = v.organization_id;

-- 5. Enable internal sync bypass session variable for backfill
SELECT set_config('healthiva.rbac_internal_sync', 'on', false);

-- 6. Synchronize memberships for verified founders
UPDATE public.memberships m
SET is_primary_owner = TRUE,
    org_authority = 'primary_owner'
FROM _verified_clinic_founders v
WHERE m.organization_id = v.organization_id
  AND m.user_id = v.primary_owner_user_id;

-- 7. Migrate role_overrides JSON into organization_role_permissions
INSERT INTO public.organization_role_permissions (organization_id, role_id, permission_id)
SELECT 
    parsed.organization_id,
    r.id AS role_id,
    p.id AS permission_id
FROM (
    SELECT 
        s.organization_id,
        kv.key AS role_name,
        elem.value AS perm_code
    FROM public.organization_settings s
    CROSS JOIN LATERAL jsonb_each(COALESCE(s.workflow_json->'role_overrides', '{}'::jsonb)) AS kv
    CROSS JOIN LATERAL jsonb_array_elements_text(kv.value) AS elem(value)
) parsed
JOIN public.roles r ON LOWER(TRIM(r.name)) = LOWER(TRIM(parsed.role_name))
JOIN public.permissions p ON p.code = parsed.perm_code
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- Reset session variable after backfill
SELECT set_config('healthiva.rbac_internal_sync', 'off', false);

-- 8. Run 4-Point Health Invariant Assertion
DO $$
DECLARE
    v_invalid_org_count INT;
    v_multi_owner_count INT;
    v_orphaned_owner_count INT;
    v_missing_membership_count INT;
BEGIN
    -- Check 1: Every active org has non-null primary_owner_user_id
    SELECT COUNT(*) INTO v_invalid_org_count
    FROM public.organizations
    WHERE status = 'active' AND primary_owner_user_id IS NULL;

    IF v_invalid_org_count > 0 THEN
        RAISE EXCEPTION 'Assertion Failed: Found % active organization(s) with NULL primary_owner_user_id.', v_invalid_org_count;
    END IF;

    -- Check 2: Exactly 1 primary owner per active org in memberships
    SELECT COUNT(*) INTO v_multi_owner_count
    FROM (
        SELECT organization_id, COUNT(*) as cnt
        FROM public.memberships
        WHERE is_primary_owner = TRUE
        GROUP BY organization_id
        HAVING COUNT(*) != 1
    ) sub;

    IF v_multi_owner_count > 0 THEN
        RAISE EXCEPTION 'Assertion Failed: Found % organization(s) with invalid primary owner count.', v_multi_owner_count;
    END IF;

    -- Check 3: Check that primary_owner_user_id matches membership
    SELECT COUNT(*) INTO v_orphaned_owner_count
    FROM public.organizations o
    JOIN public.memberships m ON m.organization_id = o.id AND m.is_primary_owner = TRUE
    WHERE o.status = 'active' AND o.primary_owner_user_id != m.user_id;

    IF v_orphaned_owner_count > 0 THEN
        RAISE EXCEPTION 'Assertion Failed: Found % mismatch(es) between organizations and memberships primary owner.', v_orphaned_owner_count;
    END IF;

    -- Check 4: Check that primary_owner_user_id actually exists in memberships
    SELECT COUNT(*) INTO v_missing_membership_count
    FROM public.organizations o
    WHERE o.status = 'active'
      AND NOT EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.organization_id = o.id 
            AND m.user_id = o.primary_owner_user_id 
            AND m.is_primary_owner = TRUE
      );

    IF v_missing_membership_count > 0 THEN
        RAISE EXCEPTION 'Assertion Failed: Found % active organization(s) where primary owner has no primary owner membership.', v_missing_membership_count;
    END IF;

    RAISE NOTICE 'Healthiva RBAC Invariant Assertion PASSED: All active clinics have valid 1:1 Primary Owners.';
END;
$$;

-- 9. Add check constraint enforcing active organizations must have primary_owner_user_id
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS chk_active_org_must_have_owner;
ALTER TABLE public.organizations
  ADD CONSTRAINT chk_active_org_must_have_owner 
  CHECK (status != 'active' OR primary_owner_user_id IS NOT NULL);

-- 10. Clean up temporary mapping table
DROP TABLE IF EXISTS _verified_clinic_founders;
