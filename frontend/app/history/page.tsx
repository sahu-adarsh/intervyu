'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import InterviewHistory from '@/components/performance/InterviewHistory';
import { getUserHistory, endInterview } from '@/lib/api';
import { useSupabaseSession } from '@/lib/supabase/auth';
import { Home } from 'lucide-react';

interface InterviewSession {
  sessionId: string;
  interviewType: string;
  candidateName: string;
  createdAt: string;
  status: 'active' | 'completed';
  overallScore?: number;
  duration?: number;
  recommendation?: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useSupabaseSession();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [endingSessionId, setEndingSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { setLoading(false); return; }

    getUserHistory()
      .then((data) => {
        const raw: any[] = data?.sessions ?? [];
        setSessions(
          raw.map((s) => ({
            sessionId: s.session_id,
            interviewType: s.interview_type,   // raw DB key — typeLabels lives in InterviewHistory
            candidateName: s.candidate_name ?? '',
            createdAt: s.date,
            status: (s.status || 'completed') as 'active' | 'completed',
            overallScore: s.score ?? undefined,
            recommendation: s.recommendation ?? undefined,
          }))
        );
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [session, authLoading]);

  const handleEndSession = async (sessionId: string) => {
    setEndingSessionId(sessionId);
    try {
      await endInterview(sessionId);
      router.push(`/report?session=${sessionId}`);
    } catch {
      setEndingSessionId(null);
    }
  };

  const handleViewReport = (sessionId: string) => {
    router.push(`/report?session=${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </button>
        </div>

        {loading ? (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center text-slate-400">
            Loading history…
          </div>
        ) : (
          <InterviewHistory
            sessions={sessions}
            onSessionClick={handleViewReport}
            onEndSession={handleEndSession}
            onViewReport={handleViewReport}
            endingSessionId={endingSessionId}
          />
        )}
      </div>
    </div>
  );
}
