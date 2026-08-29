import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

let clientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (config?: SupabaseConfig): SupabaseClient => {
  if (clientInstance) return clientInstance;

  const url = config?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const key = config?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    console.warn('[Healthiva Supabase] Warning: Missing Supabase URL or Anon Key. Using fallback placeholder.');
  }

  clientInstance = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder-key');
  return clientInstance;
};

export { createClient, SupabaseClient };
