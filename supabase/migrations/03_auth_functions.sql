-- ====================================================================
-- HEALTHIVA DATABASE MIGRATION
-- 03_auth_functions.sql
-- Description: Consolidated Authentication & Onboarding RPC Functions
-- ====================================================================

-- 1. Ensure Mobile Number Uniqueness Index on public.profiles
CREATE UNIQUE INDEX IF NOT EXISTS profiles_mobile_unique_idx 
ON public.profiles (mobile) 
WHERE mobile IS NOT NULL AND mobile != '';

-- ====================================================================
-- 2. Function: register_trial_clinic
-- Atomic multi-table provisioning for 30-Day Free Trial
-- ====================================================================
CREATE OR REPLACE FUNCTION public.register_trial_clinic(
    p_user_id UUID,
    p_clinic_name VARCHAR(255),
    p_owner_name VARCHAR(255),
    p_mobile VARCHAR(20),
    p_email VARCHAR(255),
    p_specialty VARCHAR(100) DEFAULT 'General OPD'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_slug VARCHAR(100);
    v_clean_name VARCHAR(100);
    v_random_suffix VARCHAR(6);
    v_org_id UUID;
    v_subscription_id UUID;
    v_clinic_id UUID;
    v_membership_id UUID;
    v_owner_role_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
    -- Pre-check: Ensure mobile number is not already used by another user
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE mobile = p_mobile AND id != p_user_id
    ) THEN
        RAISE EXCEPTION 'This mobile number is already registered with another clinic account. Please log in or use another number.';
    END IF;

    -- 1. Create or Update User Profile in public.profiles
    INSERT INTO public.profiles (id, full_name, mobile, email, is_platform_admin, created_at)
    VALUES (p_user_id, p_owner_name, p_mobile, p_email, FALSE, NOW())
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        mobile = EXCLUDED.mobile,
        email = EXCLUDED.email;

    -- 2. Generate Unique Clean Slug (e.g. helix-multispeciality-8a4f)
    v_clean_name := LOWER(REGEXP_REPLACE(p_clinic_name, '[^a-zA-Z0-9]', '-', 'g'));
    v_clean_name := REGEXP_REPLACE(v_clean_name, '-+', '-', 'g');
    v_clean_name := TRIM(BOTH '-' FROM v_clean_name);
    IF v_clean_name = '' THEN
        v_clean_name := 'clinic';
    END IF;
    v_random_suffix := SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 4);
    v_slug := v_clean_name || '-' || v_random_suffix;

    -- 3. Create Organization (Root Tenant)
    INSERT INTO public.organizations (
        name,
        slug,
        status,
        data_mode,
        timezone,
        country_code,
        created_at,
        updated_at
    )
    VALUES (
        p_clinic_name,
        v_slug,
        'trial_active',
        'shared',
        'Asia/Kolkata',
        'IN',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_org_id;

    -- 4. Create 30-Day Free Trial Subscription
    INSERT INTO public.subscriptions (
        organization_id,
        plan_code,
        status,
        trial_started_at,
        trial_ends_at,
        created_at
    )
    VALUES (
        v_org_id,
        'trial',
        'trial_active',
        NOW(),
        NOW() + INTERVAL '30 days',
        NOW()
    )
    RETURNING id INTO v_subscription_id;

    -- 5. Create Main Clinic Location (Branch)
    INSERT INTO public.clinics (
        organization_id,
        name,
        code,
        phone,
        email,
        city,
        is_active,
        created_at
    )
    VALUES (
        v_org_id,
        p_clinic_name || ' Main',
        'MAIN',
        p_mobile,
        p_email,
        'Surat',
        TRUE,
        NOW()
    )
    RETURNING id INTO v_clinic_id;

    -- 6. Create Organization Settings (₹300 / 30000 paise fee & module switches)
    INSERT INTO public.organization_settings (
        organization_id,
        specialty_template,
        workflow_json,
        brand_json,
        modules_json,
        created_at,
        updated_at
    )
    VALUES (
        v_org_id,
        p_specialty,
        jsonb_build_object(
            'consultation_fee', 30000,
            'followup_fee', 15000,
            'emergency_fee', 50000,
            'token_style', 'T-###',
            'reset_daily', TRUE
        ),
        jsonb_build_object(
            'print_header', p_clinic_name,
            'logo_url', NULL
        ),
        jsonb_build_object(
            'reception', TRUE,
            'billing', TRUE,
            'whatsapp_reminders', TRUE,
            'pharmacy', FALSE
        ),
        NOW(),
        NOW()
    );

    -- 7. Create Active Membership for Owner
    INSERT INTO public.memberships (
        organization_id,
        user_id,
        status,
        joined_at,
        created_at
    )
    VALUES (
        v_org_id,
        p_user_id,
        'active',
        NOW(),
        NOW()
    )
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET status = 'active'
    RETURNING id INTO v_membership_id;

    -- 8. Assign Owner Role in membership_roles
    INSERT INTO public.membership_roles (
        membership_id,
        role_id
    )
    VALUES (
        v_membership_id,
        v_owner_role_id
    )
    ON CONFLICT DO NOTHING;

    -- 9. Assign Owner to Default Main Branch Scope
    INSERT INTO public.membership_clinic_scopes (
        membership_id,
        clinic_id
    )
    VALUES (
        v_membership_id,
        v_clinic_id
    )
    ON CONFLICT DO NOTHING;

    -- 10. Return Unified JSON Result
    RETURN jsonb_build_object(
        'success', TRUE,
        'organization_id', v_org_id,
        'clinic_id', v_clinic_id,
        'subscription_id', v_subscription_id,
        'membership_id', v_membership_id,
        'slug', v_slug
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to register trial clinic: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_trial_clinic TO anon, authenticated, service_role;

-- ====================================================================
-- 3. Function: check_user_email_exists
-- Fast pre-check for Forgot Password recovery flow
-- ====================================================================
CREATE OR REPLACE FUNCTION public.check_user_email_exists(p_email VARCHAR(255))
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_email_exists TO anon, authenticated, service_role;

-- ====================================================================
-- 4. Organization Settings RLS Security Policies
-- ====================================================================
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'organization_settings' 
          AND policyname = 'Members can view settings in their organization'
    ) THEN
        CREATE POLICY "Members can view settings in their organization"
            ON public.organization_settings FOR SELECT
            USING (organization_id IN (SELECT public.get_user_organization_ids()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'organization_settings' 
          AND policyname = 'Members can update settings in their organization'
    ) THEN
        CREATE POLICY "Members can update settings in their organization"
            ON public.organization_settings FOR UPDATE
            USING (organization_id IN (SELECT public.get_user_organization_ids()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'organization_settings' 
          AND policyname = 'Members can insert settings in their organization'
    ) THEN
        CREATE POLICY "Members can insert settings in their organization"
            ON public.organization_settings FOR INSERT
            WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'memberships' 
          AND policyname = 'Users can view their own direct memberships'
    ) THEN
        CREATE POLICY "Users can view their own direct memberships"
            ON public.memberships FOR SELECT
            USING (user_id = auth.uid());
    END IF;

    -- Clinics Policies (Branch Management)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'clinics' 
          AND policyname = 'Owners can insert clinics in their organization'
    ) THEN
        CREATE POLICY "Owners can insert clinics in their organization"
            ON public.clinics FOR INSERT
            WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'clinics' 
          AND policyname = 'Owners can update clinics in their organization'
    ) THEN
        CREATE POLICY "Owners can update clinics in their organization"
            ON public.clinics FOR UPDATE
            USING (organization_id IN (SELECT public.get_user_organization_ids()));
    END IF;

    -- Membership Clinic Scopes Policies (Staff Branch Assignment)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'membership_clinic_scopes' 
          AND policyname = 'Members can view their own clinic scopes'
    ) THEN
        CREATE POLICY "Members can view their own clinic scopes"
            ON public.membership_clinic_scopes FOR SELECT
            USING (membership_id IN (SELECT id FROM public.memberships WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'membership_clinic_scopes' 
          AND policyname = 'Owners can manage clinic scopes in their organization'
    ) THEN
        CREATE POLICY "Owners can manage clinic scopes in their organization"
            ON public.membership_clinic_scopes FOR ALL
            USING (membership_id IN (SELECT id FROM public.memberships WHERE organization_id IN (SELECT public.get_user_organization_ids())));
    END IF;

    -- Role Permissions Policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'role_permissions' 
          AND policyname = 'Authenticated users can view role permissions'
    ) THEN
        CREATE POLICY "Authenticated users can view role permissions"
            ON public.role_permissions FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END $$;

-- ====================================================================
-- 5. Clinic Assets Storage Bucket Configuration
-- ====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-assets', 'clinic-assets', TRUE)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Allow public read of clinic assets'
    ) THEN
        CREATE POLICY "Allow public read of clinic assets"
            ON storage.objects FOR SELECT
            USING (bucket_id = 'clinic-assets');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Allow authenticated upload of clinic assets'
    ) THEN
        CREATE POLICY "Allow authenticated upload of clinic assets"
            ON storage.objects FOR INSERT TO authenticated
            WITH CHECK (bucket_id = 'clinic-assets');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Allow authenticated update of clinic assets'
    ) THEN
        CREATE POLICY "Allow authenticated update of clinic assets"
            ON storage.objects FOR UPDATE TO authenticated
            USING (bucket_id = 'clinic-assets');
    END IF;
END $$;
