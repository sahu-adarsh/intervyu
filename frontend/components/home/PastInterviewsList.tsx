'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface StoredSession {
  sessionId: string;
  interviewType: string;
  candidateName: string;
  date: string;
}

const typeLabels: Record<string, string> = {
  'google-sde': 'Google SDE',
  'amazon-sde': 'Amazon SDE',
  'microsoft-sde': 'Microsoft SDE',
  'aws-sa': 'AWS Solutions Architect',
  'azure-sa': 'Azure Solutions Architect',
  'gcp-sa': 'GCP Solutions Architect',
  'behavioral': 'Behavioral',
  'coding-round': 'Coding Round',
};

const typeDotColors: Record<string, string> = {
  'google-sde': 'bg-blue-400',
  'amazon-sde': 'bg-orange-400',
  'microsoft-sde': 'bg-blue-500',
  'aws-sa': 'bg-yellow-500',
  'azure-sa': 'bg-blue-400',
  'gcp-sa': 'bg-red-400',
  'behavioral': 'bg-emerald-400',
  'coding-round': 'bg-green-400',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PastInterviewsList() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StoredSession[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('intervyu_sessions') || '[]');
      setSessions(stored.slice(0, 4));
    } catch {
      setSessions([]);
    }
  }, []);

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
          onClick={() => router.push('/history')}
          className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-800/60 transition-colors text-left"
        >
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${typeDotColors[s.interviewType] || 'bg-slate-500'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">
              {typeLabels[s.interviewType] || s.interviewType}
            </p>
            <p className="text-xs text-slate-500">{formatDate(s.date)}</p>
          </div>
          <span className="text-xs text-violet-400 flex-shrink-0 whitespace-nowrap">View Analytics →</span>
        </button>
      ))}
    </div>
  );
}
