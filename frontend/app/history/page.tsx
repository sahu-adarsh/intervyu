'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import InterviewHistory from '@/components/performance/InterviewHistory';
import { Home } from 'lucide-react';

interface StoredSession {
  sessionId: string;
  interviewType: string;
  candidateName: string;
  date: string;
}

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
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const stored: StoredSession[] = JSON.parse(localStorage.getItem('intervyu_sessions') || '[]');
        if (stored.length === 0) {
          setLoading(false);
          return;
        }

        const results = await Promise.allSettled(
          stored.map(async (s) => {
            try {
              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${s.sessionId}`);
              if (!res.ok) throw new Error();
              const data = await res.json();
              return {
                sessionId: s.sessionId,
                interviewType: s.interviewType,
                candidateName: s.candidateName,
                createdAt: s.date,
                status: (data.status || 'completed') as 'active' | 'completed',
                overallScore: data.performance_report?.overallScore,
                duration: data.performance_report?.duration,
                recommendation: data.performance_report?.recommendation,
              } satisfies InterviewSession;
            } catch {
              return {
                sessionId: s.sessionId,
                interviewType: s.interviewType,
                candidateName: s.candidateName,
                createdAt: s.date,
                status: 'completed' as const,
              } satisfies InterviewSession;
            }
          })
        );

        setSessions(
          results
            .filter((r): r is PromiseFulfilledResult<InterviewSession> => r.status === 'fulfilled')
            .map((r) => r.value)
        );
      } catch {
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center text-gray-500">
            Loading history…
          </div>
        ) : (
          <InterviewHistory
            sessions={sessions}
            onSessionClick={(id) => router.push(`/report?session=${id}`)}
          />
        )}
      </div>
    </div>
  );
}
