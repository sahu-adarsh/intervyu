'use client';

import { Calendar, Clock, Loader2, StopCircle, ArrowRight, CheckCircle2, Activity } from 'lucide-react';

interface InterviewSession {
  sessionId: string;
  interviewType: string;   // raw DB key: 'google_sde', etc.
  candidateName: string;
  createdAt: string;
  status: 'active' | 'completed';
  overallScore?: number;
  duration?: number;
  recommendation?: string;
}

interface InterviewHistoryProps {
  sessions: InterviewSession[];
  onSessionClick?: (sessionId: string) => void;
  onEndSession?: (sessionId: string) => void;
  onViewReport?: (sessionId: string) => void;
  endingSessionId?: string | null;
}

// Display labels — includes aliases for legacy / alternate DB values
const typeLabels: Record<string, string> = {
  'google_sde': 'Google SDE',
  'amazon_sde': 'Amazon SDE',
  'microsoft_sde': 'Microsoft SDE',
  'aws_solutions_architect': 'AWS Solutions Architect',
  'azure_solutions_architect': 'Azure Solutions Architect',
  'gcp_solutions_architect': 'GCP Solutions Architect',
  'cv_grilling': 'Behavioral',
  'coding_practice': 'Coding Round',
  // legacy / alternate keys
  'behavioral': 'Behavioral',
  'coding': 'Coding Round',
  'coding_round': 'Coding Round',
  'aws': 'AWS Solutions Architect',
  'aws-sa': 'AWS Solutions Architect',
  'azure-sa': 'Azure Solutions Architect',
  'gcp-sa': 'GCP Solutions Architect',
  'google-sde': 'Google SDE',
  'amazon-sde': 'Amazon SDE',
  'microsoft-sde': 'Microsoft SDE',
};

// Left-border accent color per interview type
const typeAccent: Record<string, string> = {
  'google_sde': 'border-l-blue-500',
  'google-sde': 'border-l-blue-500',
  'amazon_sde': 'border-l-orange-500',
  'amazon-sde': 'border-l-orange-500',
  'microsoft_sde': 'border-l-sky-500',
  'microsoft-sde': 'border-l-sky-500',
  'aws_solutions_architect': 'border-l-amber-500',
  'aws-sa': 'border-l-amber-500',
  'azure_solutions_architect': 'border-l-blue-400',
  'azure-sa': 'border-l-blue-400',
  'gcp_solutions_architect': 'border-l-red-400',
  'gcp-sa': 'border-l-red-400',
  'cv_grilling': 'border-l-emerald-500',
  'behavioral': 'border-l-emerald-500',
  'coding_practice': 'border-l-violet-500',
  'coding': 'border-l-violet-500',
  'coding_round': 'border-l-violet-500',
};

// Type tag colors (subtle chip)
const typeTagColor: Record<string, string> = {
  'google_sde': 'bg-blue-500/10 text-blue-400',
  'google-sde': 'bg-blue-500/10 text-blue-400',
  'amazon_sde': 'bg-orange-500/10 text-orange-400',
  'amazon-sde': 'bg-orange-500/10 text-orange-400',
  'microsoft_sde': 'bg-sky-500/10 text-sky-400',
  'microsoft-sde': 'bg-sky-500/10 text-sky-400',
  'aws_solutions_architect': 'bg-amber-500/10 text-amber-400',
  'aws-sa': 'bg-amber-500/10 text-amber-400',
  'azure_solutions_architect': 'bg-blue-400/10 text-blue-300',
  'azure-sa': 'bg-blue-400/10 text-blue-300',
  'gcp_solutions_architect': 'bg-red-500/10 text-red-400',
  'gcp-sa': 'bg-red-500/10 text-red-400',
  'cv_grilling': 'bg-emerald-500/10 text-emerald-400',
  'behavioral': 'bg-emerald-500/10 text-emerald-400',
  'coding_practice': 'bg-violet-500/10 text-violet-400',
  'coding': 'bg-violet-500/10 text-violet-400',
  'coding_round': 'bg-violet-500/10 text-violet-400',
};

const getRecommendationConfig = (rec: string) => {
  const r = rec.toUpperCase().replace(/ /g, '_');
  switch (r) {
    case 'STRONG_HIRE':
      return { label: 'Strong Hire', classes: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', dot: 'bg-emerald-400' };
    case 'HIRE':
      return { label: 'Hire', classes: 'bg-green-500/15 text-green-300 border border-green-500/30', dot: 'bg-green-400' };
    case 'INCONCLUSIVE':
      return { label: 'Inconclusive', classes: 'bg-slate-500/15 text-slate-400 border border-slate-500/30', dot: 'bg-slate-400' };
    case 'NO_HIRE':
      return { label: 'No Hire', classes: 'bg-orange-500/15 text-orange-300 border border-orange-500/30', dot: 'bg-orange-400' };
    case 'STRONG_NO_HIRE':
      return { label: 'Strong No Hire', classes: 'bg-red-500/15 text-red-300 border border-red-500/30', dot: 'bg-red-400' };
    default:
      return { label: rec.replace(/_/g, ' '), classes: 'bg-slate-700/50 text-slate-400 border border-slate-600/30', dot: 'bg-slate-500' };
  }
};

const getScoreTier = (score: number) => {
  if (score >= 8.5) return { color: 'text-emerald-400', label: 'Exceptional' };
  if (score >= 7.0) return { color: 'text-blue-400',    label: 'Strong' };
  if (score >= 5.5) return { color: 'text-violet-400',  label: 'Developing' };
  if (score >= 4.0) return { color: 'text-orange-400',  label: 'Needs Work' };
  return              { color: 'text-red-400',            label: 'Critical Gap' };
};

export default function InterviewHistory({
  sessions,
  onSessionClick,
  onEndSession,
  onViewReport,
  endingSessionId,
}: InterviewHistoryProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    return {
      monthDay: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      year: date.getFullYear(),
      isCurrentYear: date.getFullYear() === now.getFullYear(),
    };
  };

  const sortedSessions = [...sessions].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 leading-none">Interview History</h2>
            {sessions.length > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-14">
          <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">No interviews yet</p>
          <p className="text-sm text-slate-600 mt-1">Complete an interview to see it here</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline spine — desktop */}
          <div className="hidden sm:block absolute left-[2.75rem] top-3 bottom-3 w-px bg-slate-800" />

          <div className="space-y-3">
            {sortedSessions.map((session) => {
              const { monthDay, time, year, isCurrentYear } = formatDate(session.createdAt);
              const displayType = typeLabels[session.interviewType] || session.interviewType;
              const accentBorder = typeAccent[session.interviewType] || 'border-l-slate-600';
              const tagColor = typeTagColor[session.interviewType] || 'bg-slate-700/50 text-slate-400';
              const isActive = session.status === 'active';
              const isEnding = endingSessionId === session.sessionId;

              return (
                <div key={session.sessionId} className="relative sm:pl-[5.5rem]">

                  {/* Timeline dot */}
                  <div className="hidden sm:flex absolute left-[2.1rem] top-4 w-[1.25rem] h-[1.25rem] items-center justify-center z-10">
                    {isActive ? (
                      <span className="relative flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-50" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-violet-500 border-2 border-slate-900" />
                      </span>
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-slate-600" />
                    )}
                  </div>

                  {/* Date label — desktop */}
                  <div className="hidden sm:block absolute left-0 top-3 w-[2rem] text-right">
                    <p className="text-[10px] font-semibold text-slate-400 leading-tight">{monthDay}</p>
                    {!isCurrentYear && (
                      <p className="text-[9px] text-slate-600 leading-tight">{year}</p>
                    )}
                  </div>

                  {/* Card */}
                  <div
                    className={`
                      border border-slate-700/60 rounded-xl overflow-hidden
                      bg-slate-800/40 hover:bg-slate-800/70
                      transition-all duration-150
                      ${isActive ? 'ring-1 ring-violet-500/20' : ''}
                    `}
                  >
                    <div className="p-4">
                      {/* Mobile date */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-2.5 sm:hidden">
                        <Calendar className="w-3 h-3" />
                        <span>{monthDay}{!isCurrentYear ? `, ${year}` : ''} · {time}</span>
                      </div>

                      {/* Top row: title + score */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-100 text-base leading-tight">{displayType}</h3>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${tagColor}`}>
                              {isActive ? 'In Progress' : 'Completed'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>{session.candidateName}</span>
                            <span className="hidden sm:inline">·</span>
                            <span className="hidden sm:flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {time}
                            </span>
                            {session.duration && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {Math.round(session.duration / 60)} min
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Score block */}
                        {session.overallScore !== undefined ? (
                          <div className="flex-shrink-0 text-right">
                            <p className={`text-2xl font-black leading-none tabular-nums ${getScoreTier(session.overallScore).color}`}>
                              {session.overallScore.toFixed(1)}
                            </p>
                            <p className="text-[10px] text-slate-600 mt-0.5">/ 10</p>
                            <p className={`text-[10px] font-semibold mt-0.5 ${getScoreTier(session.overallScore).color}`}>
                              {getScoreTier(session.overallScore).label}
                            </p>
                          </div>
                        ) : isActive ? (
                          <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-violet-400">
                            <Activity className="w-3.5 h-3.5 animate-pulse" />
                            <span className="font-medium">Live</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Bottom row: recommendation + actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-700/40">
                        {/* Left: recommendation or hint */}
                        <div className="flex items-center gap-2">
                          {!isActive && session.recommendation ? (
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${getRecommendationConfig(session.recommendation).classes}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getRecommendationConfig(session.recommendation).dot}`} />
                              {getRecommendationConfig(session.recommendation).label}
                            </div>
                          ) : isActive ? (
                            <p className="text-xs text-slate-500">End the session to generate your report</p>
                          ) : (
                            <span className="text-xs text-slate-600 italic">No recommendation</span>
                          )}
                        </div>

                        {/* Right: action button */}
                        <div className="ml-auto">
                          {isActive && onEndSession && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onEndSession(session.sessionId); }}
                              disabled={isEnding}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all shadow-lg shadow-violet-900/30"
                            >
                              {isEnding ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Generating…
                                </>
                              ) : (
                                <>
                                  <StopCircle className="w-3 h-3" />
                                  End & Get Report
                                </>
                              )}
                            </button>
                          )}
                          {!isActive && onViewReport && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onViewReport(session.sessionId); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 text-slate-300 hover:text-slate-100 text-xs font-medium transition-all"
                            >
                              View Report
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
