'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { signInWithGoogle, signInWithOtp, verifyEmailOtp } from '@/lib/supabase/auth';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18">
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
  const [loading, setLoading] = useState<'otp' | 'google' | 'verify' | null>(null);
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
    });
  }, [router]);

  async function handleOtp() {
    if (!email) { setError('Enter your email address.'); return; }
    setLoading('otp');
    setError(null);
    try {
      await signInWithOtp(email);
      setSent(true);
    } catch (e: any) {
      setError(e.message || 'Failed to send code');
    } finally {
      setLoading(null);
    }
  }

  async function handleVerify() {
    if (otp.length !== 6) { setError('Enter the 6-digit code from your email.'); return; }
    setLoading('verify');
    setError(null);
    try {
      await verifyEmailOtp(email, otp);
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Invalid or expired code');
    } finally {
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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #eef0f8 0%, #f4f2fb 50%, #eef0f8 100%)' }}
    >
      {/* Card */}
      <div className="w-full max-w-[400px] bg-white rounded-3xl shadow-[0_4px_40px_rgba(0,0,0,0.08)] px-9 py-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
            <Image src="/logo-icon.svg" alt="intervyu" width={32} height={32} className="brightness-0 invert" />
          </div>
          {!sent && (
            <h1 className="mt-4 text-[21px] font-bold text-slate-900 tracking-tight">
              Continue to Intervyu
            </h1>
          )}
        </div>

        {!sent ? (
          <>
            {/* Email field */}
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                disabled={busy}
                onKeyDown={(e) => e.key === 'Enter' && handleOtp()}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition disabled:opacity-50"
              />
            </div>

            {/* Continue button */}
            <button
              onClick={handleOtp}
              disabled={busy}
              className="w-full flex items-center justify-center h-11 rounded-xl text-[14px] font-semibold text-white mb-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' }}
            >
              {loading === 'otp'
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Continue with email'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[12px] text-slate-400 font-medium">Or continue with</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 h-11 rounded-xl text-[14px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'google'
                ? <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
                : <><GoogleIcon /><span>Google</span></>}
            </button>

            {error && (
              <p className="mt-4 text-[12px] text-red-500 text-center">{error}</p>
            )}
          </>
        ) : (
          /* OTP entry state */
          <div>
            <p className="text-[21px] font-bold text-slate-900 tracking-tight mb-1">Check your inbox</p>
            <p className="text-[13px] text-slate-500 mb-6">
              We sent a 6-digit code to <span className="font-medium text-slate-700">{email}</span>
            </p>

            <div className="mb-4">
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                disabled={loading === 'verify'}
                autoFocus
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[22px] font-mono text-slate-900 tracking-[0.15em] text-center placeholder-slate-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition disabled:opacity-50"
              />
            </div>

            <button
              onClick={handleVerify}
              disabled={loading === 'verify' || otp.length !== 6}
              className="w-full flex items-center justify-center h-11 rounded-xl text-[14px] font-semibold text-white mb-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' }}
            >
              {loading === 'verify'
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Verify code'}
            </button>

            {error && (
              <p className="mb-3 text-[12px] text-red-500 text-center">{error}</p>
            )}

            <button
              onClick={() => { setSent(false); setOtp(''); setError(null); }}
              className="w-full text-[13px] text-slate-500 hover:text-violet-600 font-medium transition text-center"
            >
              ← Use a different email
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="mt-5 text-[12px] text-slate-500 text-center">
        By signing in, you agree to our{' '}
        <span className="underline underline-offset-2 cursor-pointer">Terms of Service</span>
        .
      </p>
    </div>
  );
}
