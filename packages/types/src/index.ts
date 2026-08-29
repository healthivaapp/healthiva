// User Roles in Healthiva
export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'pharmacist';

// Subscription Status
export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

// Token Status for Patient Queue
export type TokenStatus = 'booked' | 'waiting' | 'with_doctor' | 'done' | 'cancelled';

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

// Patient Model
export interface Patient {
  id: string;
  clinic_id: string;
  uhid: string; // Unique Health ID e.g. HLV-2026-0001
  full_name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  phone: string;
  address?: string;
  medical_history?: string;
  created_at: string;
}

// Appointment / Queue Token Model
export interface AppointmentToken {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  token_number: number;
  booking_type: 'walk_in' | 'phone_call';
  status: TokenStatus;
  appointment_date: string;
  notes?: string;
  created_at: string;
}

// In-House Medicine Inventory Item Model
export interface MedicineItem {
  id: string;
  clinic_id: string;
  name: string; // e.g. Paracetamol 500mg
  generic_name?: string;
  category?: string; // e.g. Tablet, Syrup, Eye Drop
  unit_price: number;
  stock_quantity: number;
  created_at: string;
}

// Prescription Model
export interface Prescription {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  token_id?: string;
  diagnosis?: string;
  symptoms?: string;
  advice?: string;
  follow_up_date?: string;
  created_at: string;
}

// Prescription Item Model
export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  medicine_name: string;
  dosage: string; // e.g. 1-0-1
  duration: string; // e.g. 5 days
  instructions?: string; // e.g. After food
}

// Invoice / Bill Model
export interface Bill {
  id: string;
  clinic_id: string;
  patient_id: string;
  token_id?: string;
  total_amount: number;
  discount: number;
  paid_amount: number;
  payment_mode: 'cash' | 'upi' | 'card' | 'due';
  is_paid: boolean;
  created_at: string;
}
