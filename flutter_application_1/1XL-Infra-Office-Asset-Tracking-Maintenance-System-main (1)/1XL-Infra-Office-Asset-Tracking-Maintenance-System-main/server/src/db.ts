import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';

/**
 * Service-role Supabase client. Bypasses RLS — only used server-side.
 * Persists no session and does not auto-refresh tokens (we issue our own JWTs).
 */
export const db: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-client': '1xl-mobile-api' },
    },
  },
);
