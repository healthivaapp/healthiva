// ====================================================================
// HEALTHIVA SHARED TYPES — DAY 1 & 2 FOUNDATION
// ====================================================================

// User Roles in Healthiva
export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'pharmacist';

// Subscription Status for Clinics
export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

// Clinic / Tenant Model
export interface Clinic {
  id: string;
  name: string;
  subdomain: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  subscription_status: SubscriptionStatus;
  trial_ends_at?: string;
  created_at: string;
  updated_at: string;
}

// User Profile Model
export interface Profile {
  id: string; // Auth User ID (FK auth.users)
  clinic_id: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
