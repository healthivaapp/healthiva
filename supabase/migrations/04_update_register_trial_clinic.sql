-- ====================================================================
-- HEALTHIVA DATABASE MIGRATION — DAY 2
-- 04_update_register_trial_clinic.sql
-- Description: Conflict-Safe Update for register_trial_clinic Stored Procedure
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

    -- 6. Create Organization Settings (₹300 / 30000 paise consultation fee & module switches)
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
            'token_style', 'T-###'
        ),
        jsonb_build_object(
            'print_header', p_clinic_name
        ),
        jsonb_build_object(
            'reception', TRUE,
            'billing', TRUE,
            'pharmacy', TRUE
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

    -- 9. Return Unified JSON Result
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

-- Grant execution privileges to anon and authenticated clients
GRANT EXECUTE ON FUNCTION public.register_trial_clinic TO anon, authenticated, service_role;
