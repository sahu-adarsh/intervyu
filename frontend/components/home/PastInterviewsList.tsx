'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUserHistory } from '@/lib/api';
import { useSupabaseSession } from '@/lib/supabase/auth';

interface HistorySession {
  sessionId: string;
  interviewType: string;
  candidateName: string;
  status: string;
  date: string;
  score: number | null;
}

// DB returns underscore-separated types; frontend used hyphens historically
const typeLabels: Record<string, string> = {
  'google_sde': 'Google SDE',
  'amazon_sde': 'Amazon SDE',
  'microsoft_sde': 'Microsoft SDE',
  'aws_solutions_architect': 'AWS Solutions Architect',
  'azure_solutions_architect': 'Azure Solutions Architect',
  'gcp_solutions_architect': 'GCP Solutions Architect',
  'cv_grilling': 'Behavioral',
  'coding_practice': 'Coding Round',
  // aliases for legacy / alternate DB values
  'behavioral': 'Behavioral',
  'coding': 'Coding Round',
  'coding_round': 'Coding Round',
  'google-sde': 'Google SDE',
  'amazon-sde': 'Amazon SDE',
  'microsoft-sde': 'Microsoft SDE',
  'aws-sa': 'AWS Solutions Architect',
  'azure-sa': 'Azure Solutions Architect',
  'gcp-sa': 'GCP Solutions Architect',
};

const typeDotColors: Record<string, string> = {
  'google_sde': 'bg-blue-400',
  'amazon_sde': 'bg-orange-400',
  'microsoft_sde': 'bg-blue-500',
  'aws_solutions_architect': 'bg-yellow-500',
  'azure_solutions_architect': 'bg-blue-400',
  'gcp_solutions_architect': 'bg-red-400',
  'cv_grilling': 'bg-emerald-400',
  'coding_practice': 'bg-green-400',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PastInterviewsList() {
  const router = useRouter();
  const { session, loading: authLoading } = useSupabaseSession();
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = () => {
    if (authLoading || !session) return;
    getUserHistory()
      .then((data) => {
        const raw: any[] = data?.sessions ?? [];
        setSessions(
          raw.slice(0, 5).map((s) => ({
            sessionId: s.session_id,
            interviewType: s.interview_type,
            candidateName: s.candidate_name ?? '',
            status: s.status ?? 'active',
            date: s.date,
            score: s.score,
          }))
        );
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!session) { setLoading(false); return; }
    fetchHistory();
  }, [session, authLoading]);

  // Re-fetch when user returns to this page (e.g. after ending an interview)
  useEffect(() => {
    const handleFocus = () => {
      if (session && !authLoading) fetchHistory();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [session, authLoading]);

  if (loading) {
    return <p className="text-xs text-slate-600 py-3 text-center">Loading…</p>;
  }

  if (sessions.length === 0) {
    return (
      <p className="text-xs text-slate-600 py-3 text-center">No past interviews yet</p>
    );
  }

  return (
    <div className="space-y-0.5">
      {sessions.map((s) => (
        <button
          key={s.sessionId}
          onClick={() => {
            if (s.status === 'completed') {
              router.push(`/report?session=${s.sessionId}`);
            } else {
              router.push('/history');
            }
          }}
          className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-800/60 transition-colors text-left"
        >
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${typeDotColors[s.interviewType] || 'bg-slate-500'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">
              {typeLabels[s.interviewType] || s.interviewType}
            </p>
            <p className="text-xs text-slate-500">{formatDate(s.date)}</p>
          </div>
          <span className="text-xs text-violet-400 flex-shrink-0 whitespace-nowrap">
            {s.status === 'completed' ? 'View Report →' : 'View History →'}
          </span>
        </button>
      ))}
    </div>
  );
}
