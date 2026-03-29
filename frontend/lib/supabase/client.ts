import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,        // store session in localStorage
    autoRefreshToken: true,      // refresh before expiry
    detectSessionInUrl: true,    // pick up OAuth token from URL fragment on callback
  },
});
