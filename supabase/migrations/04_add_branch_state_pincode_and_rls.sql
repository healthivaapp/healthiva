-- ============================================================================
-- HEALTHIVA (healthiva.in) - Migration 04: Branch State, Pincode & Fixed RLS
-- Run this script in your Supabase SQL Editor to resolve Branch Creation/Edit issues!
-- ============================================================================

-- 1. ADD CITY, STATE, PINCODE COLUMNS TO CLINICS TABLE IF NOT EXISTS
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'Surat';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'Gujarat';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);

-- 2. ENABLE ROW LEVEL SECURITY ON CLINICS TABLE
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

-- Drop old policies to prevent conflicts
DROP POLICY IF EXISTS "Allow members to view clinics" ON clinics;
DROP POLICY IF EXISTS "Allow members to insert clinics" ON clinics;
DROP POLICY IF EXISTS "Allow members to update clinics" ON clinics;
DROP POLICY IF EXISTS "Allow members to view clinics in their organization" ON clinics;
DROP POLICY IF EXISTS "Allow owners to insert clinics in their organization" ON clinics;
DROP POLICY IF EXISTS "Allow owners to update clinics in their organization" ON clinics;

-- 3. CREATE CLEAN, WORKING RLS POLICIES FOR CLINICS TABLE

-- Policy A: SELECT (Active members can view clinics in their organization)
CREATE POLICY "Allow members to view clinics"
ON clinics FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM memberships 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Policy B: INSERT (Active members can add new branch locations)
CREATE POLICY "Allow members to insert clinics"
ON clinics FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM memberships 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Policy C: UPDATE (Active members can edit branch details & toggle active status)
CREATE POLICY "Allow members to update clinics"
ON clinics FOR UPDATE
USING (
    organization_id IN (
        SELECT organization_id FROM memberships 
        WHERE user_id = auth.uid() AND status = 'active'
    )
);
