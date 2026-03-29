'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './client';

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Returns current session, user, and loading state.
 *  Subscribes to auth state changes so components re-render on login/logout.
 */
export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hydrate immediately
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

/** Redirects to /login if not authenticated. Returns session + loading state. */
export function useRequireAuth() {
  const { session, user, loading } = useSupabaseSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.push('/login');
    }
  }, [session, loading, router]);

  return { session, user, loading };
}

// ─── Auth Actions ─────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : '/auth/callback';

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl },
  });

  if (error) throw error;
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signInWithOtp(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function verifyEmailOtp(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Returns the current access token for API / WebSocket auth. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Extracts a display name from a Supabase user (OAuth or email). */
export function getUserDisplayName(user: User | null): string {
  if (!user) return '';
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    ''
  );
}

/** Extracts avatar URL from a Supabase user (Google/GitHub provide this). */
export function getUserAvatarUrl(user: User | null): string | null {
  if (!user) return null;
  return (
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    null
  );
}
