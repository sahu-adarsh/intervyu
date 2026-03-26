'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import VoiceInterview from '@/components/VoiceInterview';

function InterviewSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const interviewType = searchParams.get('type');
  const candidateName = searchParams.get('name');
  const existingSession = searchParams.get('session');

  useEffect(() => {
    if (!interviewType || !candidateName) {
      router.push('/');
      return;
    }

    // If session was pre-created on the home page (with CV upload), use it directly
    if (existingSession) {
      setSessionId(existingSession);
      setLoading(false);
      return;
    }

    // Otherwise create a new session
    const createSession = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/api/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            interview_type: interviewType,
            candidate_name: candidateName,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create session');
        }

        const data = await response.json();
        setSessionId(data.session_id);
        setLoading(false);
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
      }
    };

    createSession();
  }, [interviewType, candidateName, existingSession, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Setting up your interview...</p>
          {candidateName && interviewType && (
            <p className="text-xs text-slate-600">{decodeURIComponent(candidateName)} · {interviewType}</p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="max-w-sm w-full mx-4 bg-red-950/60 border border-red-800 rounded-xl px-6 py-6 space-y-4 text-center">
          <p className="text-sm font-semibold text-red-400">Failed to start session</p>
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return null;
  }

  return (
    <VoiceInterview
      sessionId={sessionId}
      interviewType={interviewType || ''}
      candidateName={candidateName || ''}
    />
  );
}

export default function InterviewSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-10 h-10 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <InterviewSessionContent />
    </Suspense>
  );
}
