'use client';

import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, GraduationCap, Star, User } from 'lucide-react';
import { CVAnalysis } from './types';

interface AtsScorePanelProps {
  atsScore: number;
  analysis: CVAnalysis;
  matchedKeywords?: string[];
  missingKeywords?: string[];
}

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(0);
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const displayed = useCountUp(score);

  const isStrong = score >= 80;
  const isGood = score >= 60;
  const label = isStrong ? 'Strong' : isGood ? 'Good' : 'Needs Work';
  const labelColor = isStrong ? 'text-emerald-400' : isGood ? 'text-violet-400' : 'text-amber-400';
  const gradId = `score-grad-${score}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 124 124">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isStrong ? '#10b981' : isGood ? '#8b5cf6' : '#f59e0b'} />
              <stop offset="100%" stopColor={isStrong ? '#059669' : isGood ? '#6366f1' : '#d97706'} />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle cx="62" cy="62" r={r} fill="none" stroke="#1e293b" strokeWidth="11" />
          {/* Glow shadow */}
          <circle
            cx="62" cy="62" r={r} fill="none"
            stroke={`url(#${gradId})`} strokeWidth="11"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            opacity="0.25"
            style={{ filter: 'blur(4px)', transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
          {/* Arc */}
          <circle
            cx="62" cy="62" r={r} fill="none"
            stroke={`url(#${gradId})`} strokeWidth="11"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white leading-none tabular-nums">{displayed}</span>
          <span className="text-xs text-slate-500 mt-0.5">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-bold tracking-wide ${labelColor}`}>{label}</span>
    </div>
  );
}

interface MetricCardProps { icon: React.ReactNode; label: string; value: number; color: string; bgColor: string; }
function MetricCard({ icon, label, value, color, bgColor }: MetricCardProps) {
  const displayed = useCountUp(value, 900);
  return (
    <div className={`flex items-center gap-2.5 rounded-xl p-2.5 ${bgColor} border border-white/5`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 leading-none mb-0.5">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold text-slate-200 tabular-nums">{displayed}</span>
          <span className="text-[10px] text-slate-500">%</span>
        </div>
        <div className="h-0.5 w-full bg-slate-700/60 rounded-full mt-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${displayed}%`, background: `currentColor` }}
          />
        </div>
      </div>
    </div>
  );
}

function computeSubScores(analysis: CVAnalysis) {
  const skills = [...(analysis.skills ?? []), ...(analysis.technologies ?? [])];
  return {
    hardSkills: Math.min(100, skills.length * 4),
    experience: Math.min(100, (analysis.experience?.length ?? 0) * 25 + (analysis.totalYearsExperience ?? 0) * 5),
    education: Math.min(100, (analysis.education?.length ?? 0) * 50),
    profile: Math.min(100,
      (analysis.candidateName ? 34 : 0) + (analysis.email ? 33 : 0) + (analysis.summary ? 33 : 0)),
  };
}

function getScoreDescription(score: number) {
  if (score >= 80) return 'Your resume is well-optimised for ATS systems. Tailor keywords for each role to maximize match rates.';
  if (score >= 60) return 'Good foundation. Adding quantified achievements and more targeted skills can push this higher.';
  return 'Your resume needs more detail. Add specific skills, quantified impact, and complete your experience section.';
}

export default function AtsScorePanel({ atsScore, analysis, matchedKeywords = [], missingKeywords = [] }: AtsScorePanelProps) {
  const sub = computeSubScores(analysis);

  return (
    <div className="space-y-3">
      {/* Hero Score Card */}
      <div className="rounded-2xl overflow-hidden border border-slate-700/50"
        style={{ background: 'linear-gradient(135deg, rgb(15,23,42) 0%, rgb(23,30,51) 50%, rgb(15,23,42) 100%)' }}>
        <div className="p-4">
          <div className="flex items-start gap-4">
            <ScoreRing score={atsScore} />

            {/* Metrics grid */}
            <div className="flex-1 grid grid-cols-2 gap-2">
              <MetricCard
                icon={<Star size={13} className="text-blue-300" />}
                label="Hard Skills" value={sub.hardSkills}
                color="bg-blue-500/15 text-blue-300" bgColor="bg-slate-800/60"
              />
              <MetricCard
                icon={<TrendingUp size={13} className="text-violet-300" />}
                label="Experience" value={sub.experience}
                color="bg-violet-500/15 text-violet-300" bgColor="bg-slate-800/60"
              />
              <MetricCard
                icon={<GraduationCap size={13} className="text-emerald-300" />}
                label="Education" value={sub.education}
                color="bg-emerald-500/15 text-emerald-300" bgColor="bg-slate-800/60"
              />
              <MetricCard
                icon={<User size={13} className="text-amber-300" />}
                label="Profile" value={sub.profile}
                color="bg-amber-500/15 text-amber-300" bgColor="bg-slate-800/60"
              />
            </div>
          </div>

          {/* Score description */}
          <p className="text-xs text-slate-400 leading-relaxed mt-3 pt-3 border-t border-slate-700/50">
            {getScoreDescription(atsScore)}
          </p>
        </div>
      </div>

      {/* AI Summary */}
      {analysis.summary && (
        <div className="rounded-2xl border border-violet-500/20 bg-violet-950/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={13} className="text-violet-400" />
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">AI Summary</p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>
        </div>
      )}

      {/* Keywords */}
      {(matchedKeywords.length > 0 || missingKeywords.length > 0) && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
          {matchedKeywords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Matched Keywords ({matchedKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {matchedKeywords.slice(0, 10).map((k) => (
                  <span key={k} className="px-2 py-0.5 rounded-md bg-emerald-900/30 border border-emerald-800/50 text-emerald-300 text-xs">{k}</span>
                ))}
              </div>
            </div>
          )}
          {missingKeywords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                Missing Keywords ({missingKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missingKeywords.slice(0, 10).map((k) => (
                  <span key={k} className="px-2 py-0.5 rounded-md bg-amber-900/30 border border-amber-800/50 text-amber-300 text-xs">{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
