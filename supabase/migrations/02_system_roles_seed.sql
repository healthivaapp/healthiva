-- ====================================================================
-- HEALTHIVA DATABASE MIGRATION — DAY 2
-- 00002_system_roles_seed.sql
-- Description: System Roles (Owner, Doctor, Receptionist, Pharmacist) & Permission Keys
-- ====================================================================

-- 1. Insert System Roles
INSERT INTO public.roles (id, name, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Owner', 'Doctor-owner or hospital admin with full operational & billing control'),
  ('22222222-2222-2222-2222-222222222222', 'Doctor', 'Consulting doctor: queue view, patient history, notes, sign prescriptions'),
  ('33333333-3333-3333-3333-333333333333', 'Receptionist', 'Front desk staff: patient registration, token generation, consultation billing'),
  ('44444444-4444-4444-4444-444444444444', 'Pharmacist', 'In-house pharmacy staff: view signed prescriptions, record dispensed items')
ON CONFLICT (name) DO NOTHING;

-- 2. Insert Permission Keys
INSERT INTO public.permissions (id, code, description) VALUES
  ('a0111111-0000-0000-0000-000000000001', 'org.manage', 'Manage clinic settings, staff invites, and subscription'),
  ('a0111111-0000-0000-0000-000000000002', 'staff.manage', 'Invite and update staff roles and branch scopes'),
  ('a0111111-0000-0000-0000-000000000003', 'patient.register', 'Search and register new patients'),
  ('a0111111-0000-0000-0000-000000000004', 'queue.manage', 'Assign tokens and manage patient waiting queue'),
  ('a0111111-0000-0000-0000-000000000005', 'visit.read', 'View patient history and past consultation notes'),
  ('a0111111-0000-0000-0000-000000000006', 'visit.write', 'Write OPD visit notes and draft prescriptions'),
  ('a0111111-0000-0000-0000-000000000007', 'visits.sign', 'Sign and finalize clinical prescriptions'),
  ('a0111111-0000-0000-0000-000000000008', 'billing.collect', 'Create invoices, collect cash/UPI, and print receipts'),
  ('a0111111-0000-0000-0000-000000000009', 'billing.refund', 'Process billing refunds and financial adjustments'),
  ('a0111111-0000-0000-0000-000000000010', 'pharmacy.dispense', 'Record dispensed medicines and collect pharmacy payment'),
  ('a0111111-0000-0000-0000-000000000011', 'reports.read', 'View daily/weekly revenue and patient count reports')
ON CONFLICT (code) DO NOTHING;

-- 3. Link Role Permissions

-- OWNER: Full Access to all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '11111111-1111-1111-1111-111111111111', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- DOCTOR: Queue, Patient History, Visit Notes, Sign Prescriptions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '22222222-2222-2222-2222-222222222222', id FROM public.permissions
WHERE code IN ('queue.manage', 'visit.read', 'visit.write', 'visits.sign', 'patient.register')
ON CONFLICT DO NOTHING;

-- RECEPTIONIST: Register Patient, Queue Tokening, Collect Consultation Billing
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '33333333-3333-3333-3333-333333333333', id FROM public.permissions
WHERE code IN ('patient.register', 'queue.manage', 'billing.collect', 'visit.read')
ON CONFLICT DO NOTHING;

-- PHARMACIST: View Signed Prescriptions & Dispense Items
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '44444444-4444-4444-4444-444444444444', id FROM public.permissions
WHERE code IN ('pharmacy.dispense', 'visit.read')
ON CONFLICT DO NOTHING;
