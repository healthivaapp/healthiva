// ====================================================================
// HEALTHIVA SHARED TYPES & GLOBAL DESIGN SYSTEM
// ====================================================================

export * from './theme';
export * from './specialties';

// User Roles in Healthiva
export type UserRole = 'owner' | 'admin' | 'doctor' | 'receptionist' | 'pharmacist';

// Subscription Status for Clinics & Organizations
export type SubscriptionStatus = 'trial' | 'trial_active' | 'active' | 'suspended' | 'cancelled' | 'expired';

// Trial Registration Form Data
export interface TrialRegistrationPayload {
  clinicName: string;
  ownerName: string;
  mobile: string;
  email: string;
  password: string;
  specialty: string;
  customSpecialty?: string;
}

// Clinic / Tenant Model
export interface Clinic {
  id: string;
  organization_id?: string;
  name: string;
  code?: string;
  subdomain?: string;
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
  clinic_id?: string;
  organization_id?: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  mobile?: string;
  email?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Auth Credentials Interface
export interface SignInCredentials {
  email: string;
  password: string;
}

// Auth Result Interface
export interface AuthResult {
  user: any | null;
  profile: Profile | null;
  error: string | null;
}
