-- ====================================================================
-- HEALTHIVA DATABASE MIGRATION — DAY 1 & 2 (AUTH & TENANT FOUNDATION ONLY)
-- 01_init_tenant_schema.sql
-- Description: Minimal multi-tenant foundation: Clinics, Profiles, Auth Sync & RLS
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Enums for Auth & Tenant Management
CREATE TYPE user_role_enum AS ENUM ('admin', 'doctor', 'receptionist', 'pharmacist');
CREATE TYPE subscription_status_enum AS ENUM ('trial', 'active', 'suspended', 'cancelled');

-- 3. Create Clinics Table (Root Tenant Entity)
CREATE TABLE IF NOT EXISTS public.clinics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100) DEFAULT 'Surat',
    subscription_status subscription_status_enum DEFAULT 'trial',
    trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create User Profiles Table (Linked to Supabase auth.users & clinics)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'receptionist',
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast tenant querying
CREATE INDEX IF NOT EXISTS idx_profiles_clinic_id ON public.profiles(clinic_id);

-- 5. Trigger Function: Sync Supabase Auth Signup to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_clinic_id UUID;
BEGIN
    -- Get or create default development clinic if metadata missing
    IF (NEW.raw_user_meta_data->>'clinic_id') IS NOT NULL THEN
        default_clinic_id := (NEW.raw_user_meta_data->>'clinic_id')::UUID;
    ELSE
        SELECT id INTO default_clinic_id FROM public.clinics LIMIT 1;
        IF default_clinic_id IS NULL THEN
            INSERT INTO public.clinics (name, subdomain)
            VALUES ('Default Clinic', 'default-clinic')
            RETURNING id INTO default_clinic_id;
        END IF;
    END IF;

    INSERT INTO public.profiles (id, clinic_id, full_name, role, phone)
    VALUES (
        NEW.id,
        default_clinic_id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Healthiva Staff'),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role_enum, 'receptionist'),
        NEW.raw_user_meta_data->>'phone'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper Function to get user's clinic_id from JWT / profile
CREATE OR REPLACE FUNCTION public.get_current_clinic_id()
RETURNS UUID AS $$
    SELECT clinic_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RLS Policies for Clinics
CREATE POLICY "Users can view their own clinic data"
    ON public.clinics
    FOR SELECT
    USING (id = public.get_current_clinic_id());

-- RLS Policies for Profiles
CREATE POLICY "Users can view profiles within their clinic"
    ON public.profiles
    FOR SELECT
    USING (clinic_id = public.get_current_clinic_id());

CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING (id = auth.uid());

-- Grant privileges to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
