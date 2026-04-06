'use client';

import { CVAnalysis } from './types';

interface AtsScorePanelProps {
  atsScore: number;
  analysis: CVAnalysis;
  matchedKeywords?: string[];
  missingKeywords?: string[];
}

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#8b5cf6' : '#f59e0b';
  const label = score >= 80 ? 'Strong' : score >= 60 ? 'Good' : 'Needs Work';
  const labelColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-violet-400' : 'text-amber-400';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#1e293b" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{score}</span>
          <span className="text-xs text-slate-400">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-semibold ${labelColor}`}>{label}</span>
    </div>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-300 w-8 text-right">{value}%</span>
    </div>
  );
}

function computeSubScores(analysis: CVAnalysis, atsScore: number) {
  const skills = analysis.skills ?? [];
  const exp = analysis.experience ?? [];
  const edu = analysis.education ?? [];
  const hardSkills = Math.min(100, skills.length * 4);
  const experience = Math.min(100, exp.length * 25 + (analysis.totalYearsExperience ?? 0) * 5);
  const education = Math.min(100, edu.length * 50);
  const softSkills = Math.min(100, atsScore + 10);
  return { hardSkills, experience, education, softSkills };
}

export default function AtsScorePanel({ atsScore, analysis, matchedKeywords = [], missingKeywords = [] }: AtsScorePanelProps) {
  const sub = computeSubScores(analysis, atsScore);

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="bg-slate-800/60 rounded-xl p-4 flex items-center gap-6">
        <ScoreRing score={atsScore} />
        <div className="flex-1 space-y-2.5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ATS Score</p>
          <MetricBar label="Hard Skills" value={sub.hardSkills} color="#3b82f6" />
          <MetricBar label="Experience" value={sub.experience} color="#8b5cf6" />
          <MetricBar label="Education" value={sub.education} color="#10b981" />
          <MetricBar label="Profile" value={sub.softSkills} color="#f59e0b" />
        </div>
      </div>

      {/* AI Summary */}
      {analysis.summary && (
        <div className="bg-slate-800/60 rounded-xl p-4">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">AI Summary</p>
          <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>
        </div>
      )}

      {/* Keywords (only shown when job description was provided) */}
      {(matchedKeywords.length > 0 || missingKeywords.length > 0) && (
        <div className="bg-slate-800/60 rounded-xl p-4 space-y-3">
          {matchedKeywords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-400 mb-1.5">Matched Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {matchedKeywords.slice(0, 10).map((k) => (
                  <span key={k} className="px-2 py-0.5 bg-emerald-900/40 text-emerald-300 rounded text-xs">{k}</span>
                ))}
              </div>
            </div>
          )}
          {missingKeywords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-400 mb-1.5">Missing Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {missingKeywords.slice(0, 10).map((k) => (
                  <span key={k} className="px-2 py-0.5 bg-amber-900/40 text-amber-300 rounded text-xs">{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
