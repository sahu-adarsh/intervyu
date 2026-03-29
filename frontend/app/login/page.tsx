'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '@/lib/supabase/auth';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'login' | 'signup' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
    });
  }, [router]);

  async function handleLogin() {
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setLoading('login');
    setError(null);
    try {
      await signInWithEmail(email, password);
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Login failed');
      setLoading(null);
    }
  }

  async function handleSignUp() {
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setLoading('signup');
    setError(null);
    try {
      await signUpWithEmail(email, password);
      setNotice('Check your email to confirm your account, then log in.');
      setLoading(null);
    } catch (e: any) {
      setError(e.message || 'Sign up failed');
      setLoading(null);
    }
  }

  async function handleGoogle() {
    setLoading('google');
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError(e.message || 'Google sign-in failed');
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-indigo-600/8 rounded-full blur-2xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-white">interv</span>
            <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">yu</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">AI-powered interview practice</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white text-center mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm text-center mb-6">Sign in to continue your practice</p>

          {/* Email + password */}
          <div className="space-y-3 mb-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50"
            />
          </div>

          {/* Login + Sign Up buttons */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={handleLogin}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {loading === 'login' ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : 'Login'}
            </button>
            <button
              onClick={handleSignUp}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {loading === 'signup' ? (
                <span className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
              ) : 'Sign Up'}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-500">Or continue with</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold rounded-xl transition-colors text-sm"
          >
            {loading === 'google' ? (
              <span className="w-4 h-4 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          {error && (
            <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
          )}
          {notice && (
            <p className="mt-4 text-sm text-emerald-400 text-center">{notice}</p>
          )}

          <p className="mt-6 text-xs text-slate-500 text-center">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
