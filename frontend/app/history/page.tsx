'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import InterviewHistory from '@/components/performance/InterviewHistory';
import { getUserHistory } from '@/lib/api';
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

// DB returns underscore-separated types; map to display labels
const typeLabels: Record<string, string> = {
  'google_sde': 'Google SDE',
  'amazon_sde': 'Amazon SDE',
  'microsoft_sde': 'Microsoft SDE',
  'aws_solutions_architect': 'AWS Solutions Architect',
  'azure_solutions_architect': 'Azure Solutions Architect',
  'gcp_solutions_architect': 'GCP Solutions Architect',
  'cv_grilling': 'Behavioral',
  'coding_practice': 'Coding Round',
};

export default function HistoryPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useSupabaseSession();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { setLoading(false); return; }

    getUserHistory()
      .then((data) => {
        const raw: any[] = data?.sessions ?? [];
        setSessions(
          raw.map((s) => ({
            sessionId: s.session_id,
            interviewType: typeLabels[s.interview_type] || s.interview_type,
            candidateName: s.candidate_name ?? '',
            createdAt: s.date,
            status: (s.status || 'completed') as 'active' | 'completed',
            overallScore: s.score ?? undefined,
          }))
        );
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [session, authLoading]);

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
