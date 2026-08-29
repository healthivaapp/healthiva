-- ====================================================================
-- HEALTHIVA SEED DATA — DEVELOPMENT ENVIRONMENT
-- seed.sql
-- Description: Sample clinic for Surat OPD testing
-- ====================================================================

-- Insert Sample Demo Clinic
INSERT INTO public.clinics (id, name, subdomain, phone, email, address, city, subscription_status)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Surat Health Care Clinic',
    'surat-care',
    '+91 98765 43210',
    'contact@suratcare.in',
    '101 Ring Road, Near Majura Gate',
    'Surat',
    'trial'
)
ON CONFLICT (subdomain) DO NOTHING;
