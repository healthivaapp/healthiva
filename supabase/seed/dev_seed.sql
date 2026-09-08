-- ====================================================================
-- HEALTHIVA SEED DATA — DEVELOPMENT ENVIRONMENT (DEV_SEED.SQL)
-- Description: Fake test hospitals to verify multi-tenant isolation
-- ====================================================================

-- 1. Fake Hospital 1: Sunrise Eye Hospital (Surat)
INSERT INTO public.organizations (id, name, slug, status, data_mode, timezone, country_code)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'Sunrise Eye Hospital',
    'sunrise-eye',
    'trial_active',
    'shared',
    'Asia/Kolkata',
    'IN'
) ON CONFLICT (slug) DO NOTHING;

-- 1.1 Sunrise Subscriptions
INSERT INTO public.subscriptions (id, organization_id, plan_code, status, trial_started_at, trial_ends_at)
VALUES (
    'd0000001-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'trial',
    'trial_active',
    NOW(),
    NOW() + INTERVAL '14 days'
) ON CONFLICT DO NOTHING;

-- 1.2 Sunrise Branches (Main + Adajan)
INSERT INTO public.clinics (id, organization_id, name, code, phone, email, address, city)
VALUES 
(
    'c0000001-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Sunrise Eye Hospital Main Branch',
    'SUNRISE-MAIN',
    '+91 98765 43210',
    'contact@sunriseeye.in',
    '101 Ring Road, Majura Gate',
    'Surat'
),
(
    'c0000001-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000001',
    'Sunrise Eye Hospital Adajan Branch',
    'SUNRISE-ADAJAN',
    '+91 98765 43211',
    'adajan@sunriseeye.in',
    '202 L.P. Savani Road, Adajan',
    'Surat'
) ON CONFLICT DO NOTHING;

-- 1.3 Sunrise Organization Settings
INSERT INTO public.organization_settings (organization_id, specialty_template, workflow_json, brand_json, modules_json)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'eye',
    '{"consultation_fee":30000,"followup_fee":15000,"token_style":"T-###"}'::jsonb,
    '{"print_header":"Dr. Patel — Sunrise Eye Hospital, Surat"}'::jsonb,
    '{"reception":true,"billing":true,"pharmacy":false}'::jsonb
) ON CONFLICT (organization_id) DO NOTHING;


-- 2. Fake Hospital 2: Smile Heart Clinic (Surat) — Used to test RLS Security Isolation!
INSERT INTO public.organizations (id, name, slug, status, data_mode, timezone, country_code)
VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'Smile Heart Clinic',
    'smile-heart',
    'active',
    'shared',
    'Asia/Kolkata',
    'IN'
) ON CONFLICT (slug) DO NOTHING;

-- 2.1 Smile Subscriptions
INSERT INTO public.subscriptions (id, organization_id, plan_code, status, trial_started_at, trial_ends_at)
VALUES (
    'd0000002-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'paid_pro',
    'active',
    NOW() - INTERVAL '30 days',
    NOW() + INTERVAL '335 days'
) ON CONFLICT DO NOTHING;

-- 2.2 Smile Branch
INSERT INTO public.clinics (id, organization_id, name, code, phone, email, address, city)
VALUES (
    'c0000002-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'Smile Heart Clinic Main Branch',
    'SMILE-MAIN',
    '+91 91234 56789',
    'info@smileheart.in',
    '505 Ghoddod Road',
    'Surat'
) ON CONFLICT DO NOTHING;

-- 2.3 Smile Organization Settings
INSERT INTO public.organization_settings (organization_id, specialty_template, workflow_json, brand_json, modules_json)
VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'cardiology',
    '{"consultation_fee":50000,"followup_fee":25000,"token_style":"S-###"}'::jsonb,
    '{"print_header":"Dr. Shah — Smile Heart Clinic, Surat"}'::jsonb,
    '{"reception":true,"billing":true,"pharmacy":true}'::jsonb
) ON CONFLICT (organization_id) DO NOTHING;
