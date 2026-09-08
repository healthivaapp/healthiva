-- ====================================================================
-- HEALTHIVA DATABASE MIGRATION — DAY 2
-- 01_initial_core_schema.sql
-- Description: Core Multi-Tenant Architecture & RBAC Security Layer
-- ====================================================================

-- 1. Enable Extensions (if needed)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Organizations (Root Tenant Entity)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'trial_active', -- trial_active, active, suspended, cancelled
    data_mode VARCHAR(50) DEFAULT 'shared',     -- shared, dedicated
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    country_code VARCHAR(10) DEFAULT 'IN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Subscriptions (Trial & Paid Plan Tracking)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_code VARCHAR(50) DEFAULT 'trial',
    status VARCHAR(50) DEFAULT 'trial_active',
    trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Clinics (Branch Locations per Hospital/Organization)
CREATE TABLE IF NOT EXISTS public.clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100) DEFAULT 'Surat',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Organization Settings (Fees, Print Headers, Active Modules)
CREATE TABLE IF NOT EXISTS public.organization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID UNIQUE NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    specialty_template VARCHAR(100) DEFAULT 'general',
    workflow_json JSONB DEFAULT '{"consultation_fee":30000,"followup_fee":15000,"token_style":"T-###"}'::jsonb,
    brand_json JSONB DEFAULT '{"print_header":"Healthiva Clinic"}'::jsonb,
    modules_json JSONB DEFAULT '{"reception":true,"billing":true,"pharmacy":false}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Profiles (User Records Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20),
    email VARCHAR(255),
    is_platform_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Memberships (Links User Profiles to Organizations)
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'invited', -- invited, active, disabled
    invited_by UUID REFERENCES public.profiles(id),
    joined_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

-- 8. RBAC System: Roles, Permissions, Role_Permissions, Membership_Roles
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL, -- Owner, Doctor, Receptionist, Pharmacist
    description TEXT
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL, -- e.g. visits.sign, billing.refund
    description TEXT
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.membership_roles (
    membership_id UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (membership_id, role_id)
);

-- 9. Membership Clinic Scopes (Branch Access Scoping)
CREATE TABLE IF NOT EXISTS public.membership_clinic_scopes (
    membership_id UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    PRIMARY KEY (membership_id, clinic_id)
);

-- 10. Audit Events (Immutable Security Log)
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    details_json JSONB,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS Security on all Tenant Tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Helper SQL Function: Get Active Organization IDs for Logged-in User
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS SETOF UUID AS $$
    SELECT organization_id 
    FROM public.memberships 
    WHERE user_id = auth.uid() AND status = 'active';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RLS Policies
CREATE POLICY "Members can view their own organization"
    ON public.organizations FOR SELECT
    USING (id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Members can view clinics in their organization"
    ON public.clinics FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid() OR is_platform_admin = TRUE);

CREATE POLICY "Users can view memberships in their organization"
    ON public.memberships FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organization_ids()));

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
