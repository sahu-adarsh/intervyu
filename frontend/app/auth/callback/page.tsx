'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

/**
 * OAuth callback page.
 *
 * After Google/GitHub OAuth, Supabase redirects to this URL with the access
 * token in the URL fragment (#access_token=...).
 *
 * Because supabase-js is configured with detectSessionInUrl: true, it
 * automatically reads and stores the session from the URL fragment.
 * We just wait for the auth state change and redirect to home.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          subscription.unsubscribe();
          router.replace('/dashboard');
        }
      }
    );

    // Also check if a session already exists (fast path for page reload)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        subscription.unsubscribe();
        router.replace('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-slate-700 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
