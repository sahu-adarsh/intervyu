'use client';

import { useEffect, useState } from 'react';
import {
  Target, Loader2, ChevronRight, TrendingUp,
  AlertCircle, CheckCircle2, MinusCircle, XCircle,
  BookOpen,
} from 'lucide-react';
import { triggerJdGapAnalysis, getJdGapReport, type JdGapReport, type JdGapSkillItem } from '@/lib/api';

interface JobMatchPanelProps {
  sessionId: string;
  jobTitle?: string;
  jobDescription?: string;
}

// ── tiny sub-components ───────────────────────────────────────────────────────

function StatusPill({ status }: { status: JdGapSkillItem['status'] }) {
  if (status === 'present') return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-medium whitespace-nowrap">
      <CheckCircle2 className="w-2.5 h-2.5" /> Present
    </span>
  );
  if (status === 'partial') return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium whitespace-nowrap">
      <MinusCircle className="w-2.5 h-2.5" /> Partial
    </span>
  );
  return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-red-500/15 text-red-400 border border-red-500/20 font-medium whitespace-nowrap">
      <XCircle className="w-2.5 h-2.5" /> Missing
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#8b5cf6' : '#f59e0b';
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#1e293b" strokeWidth="6" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 36 36)" />
      <text x="36" y="41" textAnchor="middle" fontSize="15" fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

// ── main component ────────────────────────────────────────────────────────────

type State = 'idle' | 'loading' | 'ready' | 'error';

export default function JobMatchPanel({ sessionId, jobTitle, jobDescription }: JobMatchPanelProps) {
  const [state, setState] = useState<State>('idle');
  const [report, setReport] = useState<JdGapReport | null>(null);
  const [openSection, setOpenSection] = useState<'required' | 'preferred' | 'bridges' | 'prep' | null>('required');

  useEffect(() => {
    if (!sessionId || !jobDescription?.trim()) return;

    setState('loading');

    // First check if background task already produced a cached report
    getJdGapReport(sessionId)
      .then(({ gap_report }) => { setReport(gap_report); setState('ready'); })
      .catch(() => {
        // Not cached yet — trigger it now
        triggerJdGapAnalysis(sessionId, jobTitle?.trim() ?? '', jobDescription.trim())
          .then(({ gap_report }) => { setReport(gap_report); setState('ready'); })
          .catch(() => setState('error'));
      });
  // Run only when sessionId changes (re-opening a different resume)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── wrapper shell ───────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Target size={13} className="text-violet-400" />
          </div>
          <span className="text-sm font-semibold text-slate-200">Job Match</span>
          {state === 'ready' && report && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              report.match_score >= 70
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                : report.match_score >= 45
                  ? 'bg-violet-500/15 text-violet-400 border-violet-500/20'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
            }`}>
              {report.match_score}/100
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">

        {/* No JD */}
        {!jobDescription?.trim() && (
          <p className="text-xs text-slate-500 text-center py-4">
            No job description detected.<br />
            <span className="text-slate-400">Re-upload your CV with a job description to see match analysis.</span>
          </p>
        )}

        {/* Loading */}
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-2 py-6">
            <Loader2 size={20} className="text-violet-400 animate-spin" />
            <p className="text-xs text-slate-400">Analysing match against job description…</p>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="flex items-start gap-2 bg-red-950/30 border border-red-800/40 rounded-xl px-3 py-3">
            <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-400">Analysis failed. Try re-uploading the CV.</p>
          </div>
        )}

        {/* Report */}
        {state === 'ready' && report && (
          <div className="space-y-4">

            {/* Score + seniority */}
            <div className="flex items-start gap-3">
              <ScoreRing score={report.match_score} />
              <div className="flex-1 space-y-2 min-w-0">
                <p className="text-[11px] text-slate-400 leading-relaxed">{report.match_score_reason}</p>
                <div className={`rounded-lg px-3 py-2 text-[11px] font-medium border ${
                  report.seniority_fit === 'good-fit'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : report.seniority_fit === 'under-qualified'
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  {report.seniority_fit === 'good-fit' ? 'Good seniority fit'
                    : report.seniority_fit === 'under-qualified' ? 'Under-qualified for this level'
                    : 'Over-qualified for this level'}
                  {report.seniority_reason && (
                    <span className="block font-normal opacity-80 mt-0.5">{report.seniority_reason}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Strengths + Gaps */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-emerald-400 mb-2 flex items-center gap-1">
                  <TrendingUp size={11} /> Strengths
                </p>
                <ul className="space-y-1">
                  {report.top_strengths.map((s, i) => (
                    <li key={i} className="text-[10px] text-slate-400 flex gap-1.5 leading-relaxed">
                      <ChevronRight size={10} className="flex-shrink-0 mt-0.5 text-emerald-500/60" />{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-red-400 mb-2 flex items-center gap-1">
                  <AlertCircle size={11} /> Gaps
                </p>
                <ul className="space-y-1">
                  {report.critical_gaps.map((g, i) => (
                    <li key={i} className="text-[10px] text-slate-400 flex gap-1.5 leading-relaxed">
                      <ChevronRight size={10} className="flex-shrink-0 mt-0.5 text-red-500/60" />{g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Accordion sections */}
            {[
              {
                key: 'required' as const,
                label: `Required Skills (${report.required_skills.length})`,
                content: (
                  <div className="divide-y divide-slate-700/40">
                    {report.required_skills.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 px-1">
                        <StatusPill status={item.status} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-slate-300">{item.skill}</p>
                          {item.resume_evidence && (
                            <p className="text-[10px] text-slate-500 italic mt-0.5 truncate" title={item.resume_evidence}>
                              "{item.resume_evidence}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                key: 'preferred' as const,
                label: `Preferred Skills (${report.preferred_skills.length})`,
                content: (
                  <div className="divide-y divide-slate-700/40">
                    {report.preferred_skills.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 px-1">
                        <StatusPill status={item.status} />
                        <p className="text-[11px] text-slate-300">{item.skill}</p>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                key: 'bridges' as const,
                label: `Transferable Experience (${report.transferable_bridges.length})`,
                content: (
                  <div className="space-y-2">
                    {report.transferable_bridges.map((b, i) => (
                      <div key={i} className="bg-slate-800 rounded-lg p-3 border border-slate-700/40">
                        <div className="flex flex-wrap gap-x-2 text-[10px] mb-1.5">
                          <span className="text-red-400">Needs: {b.jd_requires}</span>
                          <span className="text-slate-600">→</span>
                          <span className="text-violet-400">You have: {b.candidate_has}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{b.bridge}</p>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                key: 'prep' as const,
                label: `Interview Prep (${report.interview_preparation.length} gaps)`,
                content: (
                  <div className="space-y-3">
                    {report.interview_preparation.map((p, i) => (
                      <div key={i} className="bg-slate-800 rounded-xl border border-slate-700/40 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/30 border-b border-slate-700/40">
                          <AlertCircle size={11} className="text-amber-400 flex-shrink-0" />
                          <span className="text-[10px] font-semibold text-slate-300 truncate">Gap: {p.gap}</span>
                        </div>
                        <div className="px-3 py-2.5 space-y-2">
                          <div className="border-l-2 border-violet-500/40 pl-2">
                            <p className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">Expected question</p>
                            <p className="text-[10px] text-slate-300 italic">"{p.expected_question}"</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                              <BookOpen size={8} /> Bridge via: {p.resume_bridge}
                            </p>
                            <p className="text-[10px] text-slate-400 leading-relaxed">{p.framing_advice}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              },
            ].map(({ key, label, content }) => (
              <div key={key} className="border border-slate-700/40 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenSection(s => s === key ? null : key)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-800/60 hover:bg-slate-800 transition-colors text-left"
                >
                  <span className="text-[11px] font-semibold text-slate-300">{label}</span>
                  <ChevronRight size={12} className={`text-slate-500 transition-transform ${openSection === key ? 'rotate-90' : ''}`} />
                </button>
                {openSection === key && (
                  <div className="px-3 py-3 bg-slate-900/40">
                    {content}
                  </div>
                )}
              </div>
            ))}

          </div>
        )}
      </div>
    </div>
  );
}
