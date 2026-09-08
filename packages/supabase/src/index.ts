import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

let clientInstance: SupabaseClient | null = null;
let adminClientInstance: SupabaseClient | null = null;

/**
 * Standard Supabase client (Client-side / Anon)
 * Reads strictly from direct environment variables (inlined by Turbopack/Next.js)
 */
export const getSupabaseClient = (config?: SupabaseConfig): SupabaseClient => {
  if (clientInstance && !config) return clientInstance;

  const url =
    config?.supabaseUrl ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';

  const key =
    config?.supabaseAnonKey ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  if (!url || !key) {
    throw new Error(
      'Database connection failed: missing environment configuration. Please ensure .env.local is present and restart the server.'
    );
  }

  const client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  if (!config) {
    clientInstance = client;
  }
  return client;
};

/**
 * Administrative Supabase client (Server-side API routes)
 * Reads service role key or falls back to anon key from direct environment variables
 */
export const getSupabaseAdminClient = (config?: SupabaseConfig): SupabaseClient => {
  if (adminClientInstance && !config) return adminClientInstance;

  const url =
    config?.supabaseUrl ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    '';

  const key =
    config?.supabaseAnonKey ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  if (!url || !key) {
    throw new Error(
      'Database connection failed: missing environment configuration. Please ensure .env.local is present and restart the server.'
    );
  }

  const client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  if (!config) {
    adminClientInstance = client;
  }
  return client;
};

export * from './auth';
export { createClient, SupabaseClient };
