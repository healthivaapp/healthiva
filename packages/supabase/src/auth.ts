import { getSupabaseClient } from './index';
import type { SignInCredentials, AuthResult, Profile } from '@healthiva/types';

/**
 * Common Sign-In function used across Web and Mobile
 */
export async function signInWithEmail({ email, password }: SignInCredentials): Promise<AuthResult> {
  try {
    const supabase = getSupabaseClient();

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData?.user) {
      return {
        user: null,
        profile: null,
        error: authError?.message || 'Authentication failed. Please check your credentials.',
      };
    }

    // 2. Fetch User Membership status to block suspended staff at login
    const { data: memData } = await supabase
      .from('memberships')
      .select('status')
      .eq('user_id', authData.user.id)
      .limit(1)
      .maybeSingle();

    if (memData && (memData.status === 'suspended' || memData.status === 'disabled')) {
      await supabase.auth.signOut();
      return {
        user: null,
        profile: null,
        error: 'Your staff access account has been suspended by the clinic owner. Please contact your clinic administrator.',
      };
    }

    // 3. Fetch User Profile from public.profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError) {
      console.warn('[Healthiva Supabase] Warning fetching profile:', profileError.message);
    }

    const profile: Profile | null = profileData
      ? {
          id: profileData.id,
          clinic_id: profileData.clinic_id,
          full_name: profileData.full_name,
          role: profileData.role,
          phone: profileData.phone,
          email: profileData.email || authData.user.email,
          is_active: profileData.is_active,
          created_at: profileData.created_at,
          updated_at: profileData.updated_at,
        }
      : null;

    return {
      user: authData.user,
      profile,
      error: null,
    };
  } catch (err: any) {
    return {
      user: null,
      profile: null,
      error: err?.message || 'An unexpected error occurred during login.',
    };
  }
}

/**
 * Common Sign-Out function
 */
export async function signOutUser(): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    return { error: error ? error.message : null };
  } catch (err: any) {
    return { error: err?.message || 'Error signing out.' };
  }
}

/**
 * Get the currently logged-in user
 */
export async function getCurrentUser(): Promise<any | null> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * Get active auth session
 */
export async function getSession(): Promise<any | null> {
  try {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch {
    return null;
  }
}

/**
 * Send password reset email via Supabase Auth
 */
export async function sendPasswordResetEmail(email: string, redirectTo?: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const redirect = redirectTo || (typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirect,
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (err: any) {
    return { error: err?.message || 'Failed to send password reset email.' };
  }
}

/**
 * Update authenticated user's password (called on /reset-password)
 */
export async function updateUserPassword(newPassword: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (err: any) {
    return { error: err?.message || 'Failed to update password.' };
  }
}
