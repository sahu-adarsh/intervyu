'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from 'recharts';
import {
  Download, Clock, MessageSquare, Code2, Minus, Loader2, ChevronDown
} from 'lucide-react';
import { getBenchmarks, getTranscript } from '@/lib/api';
import { useSupabaseSession, getUserAvatarUrl } from '@/lib/supabase/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DBPerformanceReport {
  id?: string;
  session_id?: string;
  user_id?: string;
  overallScore: number;
  recommendation: string;
  scores: {
    technicalKnowledge: number;
    problemSolving: number;
    communication: number;
    codeQuality: number;
    culturalFit: number;
  };
  strengths: string[];
  improvements: string[];
  detailed_feedback?: string;
  detailedFeedback?: string;
  metadata?: {
    sessionId?: string;
    candidateName?: string;
    interviewType?: string;
    timestamp?: string;
    duration?: number;
    metrics?: {
      totalQuestions?: number;
      codeSubmissions?: number;
      averageResponseTime?: number;
    };
    [key: string]: unknown;
  };
  created_at?: string;
  candidateName?: string;
  interviewType?: string;
  timestamp?: string;
  duration?: number;
}

interface BenchmarkData {
  has_data?: boolean;
  sample_size?: number;
  p25?: number;
  p50?: number;
  p75?: number;
  p90?: number;
  min?: number;
  max?: number;
  avg?: number;
}

interface TranscriptMessage {
  role: string;
  content: string;
  timestamp: string;
}

interface PerformanceDashboardProps {
  report: DBPerformanceReport;
  onExportPDF?: () => void;
}

// ─── Lookup maps ──────────────────────────────────────────────────────────────

const labelToKey: Record<string, string> = {
  'google_sde': 'google_sde', 'amazon_sde': 'amazon_sde',
  'microsoft_sde': 'microsoft_sde', 'aws_solutions_architect': 'aws_solutions_architect',
  'azure_solutions_architect': 'azure_solutions_architect', 'gcp_solutions_architect': 'gcp_solutions_architect',
  'cv_grilling': 'cv_grilling', 'coding_practice': 'coding_practice',
  'Google SDE': 'google_sde', 'Amazon SDE': 'amazon_sde', 'Microsoft SDE': 'microsoft_sde',
  'AWS Solutions Architect': 'aws_solutions_architect', 'Azure Solutions Architect': 'azure_solutions_architect',
  'GCP Solutions Architect': 'gcp_solutions_architect', 'Behavioral': 'cv_grilling', 'Coding Round': 'coding_practice',
};

const typeDisplayLabels: Record<string, string> = {
  'google_sde': 'Google SDE', 'amazon_sde': 'Amazon SDE', 'microsoft_sde': 'Microsoft SDE',
  'aws_solutions_architect': 'AWS Solutions Architect', 'azure_solutions_architect': 'Azure Solutions Architect',
  'gcp_solutions_architect': 'GCP Solutions Architect', 'cv_grilling': 'Behavioral', 'coding_practice': 'Coding Round',
};

// ─── Score tiers ──────────────────────────────────────────────────────────────

interface ScoreTier {
  color: string; strokeColor: string; label: string; radarFill: string; badgeClasses: string; barColor: string;
}

function getScoreTier(score: number): ScoreTier {
  if (score >= 8.5) return { color: 'text-emerald-400', strokeColor: '#34d399', label: 'Exceptional', radarFill: '#34d399', badgeClasses: 'bg-emerald-500/10 text-emerald-400', barColor: '#34d399' };
  if (score >= 7.0) return { color: 'text-blue-400', strokeColor: '#60a5fa', label: 'Strong', radarFill: '#60a5fa', badgeClasses: 'bg-blue-500/10 text-blue-400', barColor: '#60a5fa' };
  if (score >= 5.5) return { color: 'text-violet-400', strokeColor: '#a78bfa', label: 'Developing', radarFill: '#a78bfa', badgeClasses: 'bg-violet-500/10 text-violet-400', barColor: '#a78bfa' };
  if (score >= 4.0) return { color: 'text-orange-400', strokeColor: '#fb923c', label: 'Needs Work', radarFill: '#fb923c', badgeClasses: 'bg-orange-500/10 text-orange-400', barColor: '#fb923c' };
  return { color: 'text-red-400', strokeColor: '#f87171', label: 'Critical Gap', radarFill: '#ef4444', badgeClasses: 'bg-red-500/10 text-red-400', barColor: '#f87171' };
}

// ─── Recommendation config ────────────────────────────────────────────────────

function getRecConfig(rec: string) {
  switch (rec.toUpperCase().replace(/ /g, '_')) {
    case 'STRONG_HIRE': return { label: 'Strong Hire', classes: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', dot: 'bg-emerald-400' };
    case 'HIRE': return { label: 'Hire', classes: 'bg-green-500/15 text-green-300 border border-green-500/30', dot: 'bg-green-400' };
    case 'INCONCLUSIVE': return { label: 'Inconclusive', classes: 'bg-slate-600/30 text-slate-300 border border-slate-600/40', dot: 'bg-slate-400' };
    case 'NO_HIRE': return { label: 'No Hire', classes: 'bg-orange-500/15 text-orange-300 border border-orange-500/30', dot: 'bg-orange-400' };
    case 'STRONG_NO_HIRE': return { label: 'Strong No Hire', classes: 'bg-red-500/15 text-red-300 border border-red-500/30', dot: 'bg-red-400' };
    default: return { label: rec.replace(/_/g, ' ') || '—', classes: 'bg-slate-700/40 text-slate-300 border border-slate-600/40', dot: 'bg-slate-400' };
  }
}

// ─── Benchmark helpers ────────────────────────────────────────────────────────

function lerp(x: number, x0: number, x1: number, y0: number, y1: number) {
  return x1 === x0 ? y0 : Math.round(y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
}
function calcPercentile(s: number, b: BenchmarkData) {
  const { p25 = 0, p50 = 0, p75 = 0, p90 = 0, min = 0, max = 10 } = b;
  if (s <= min) return 0; if (s >= max) return 100;
  if (s <= p25) return lerp(s, min, p25, 0, 25); if (s <= p50) return lerp(s, p25, p50, 25, 50);
  if (s <= p75) return lerp(s, p50, p75, 50, 75); if (s <= p90) return lerp(s, p75, p90, 75, 90);
  return lerp(s, p90, max, 90, 100);
}
function toPct(score: number, min: number, max: number) {
  return Math.min(Math.max(((score - min) / (max - min)) * 100, 0), 100);
}

// ─── detailed_feedback parser ─────────────────────────────────────────────────

interface FeedbackNotes {
  bottom_line: string;
  observations: { title: string; body: string }[];
}

function parseFeedbackNotes(text: string): FeedbackNotes | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed.observations) return parsed as FeedbackNotes;
  } catch {}
  // Legacy plain-text fallback: convert to observation format
  const lines = text.split('\n');
  const observations: { title: string; body: string }[] = [];
  let cur: { title: string; lines: string[] } | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^(?:\d+\.\s+)?(?:\*{1,2})?([A-Z][A-Za-z ]{2,40})(?:\*{0,2}):?\s*$/);
    if (m && line.length < 55) {
      if (cur) observations.push({ title: cur.title, body: cur.lines.join('\n').trim() });
      cur = { title: m[1].trim(), lines: [] };
    } else if (cur && line) {
      cur.lines.push(raw);
    }
  }
  if (cur) observations.push({ title: cur.title, body: cur.lines.join('\n').trim() });
  const filtered = observations.filter(s => s.body.length > 15);
  return filtered.length > 0 ? { bottom_line: '', observations: filtered } : null;
}

function parseFeedbackItem(text: string): { title: string; body: string } {
  const ci = text.indexOf(':');
  if (ci > 0 && ci < 50 && !text.slice(0, ci).includes('.'))
    return { title: text.slice(0, ci).trim(), body: text.slice(ci + 1).trim() };
  const m = text.match(/^([^.]{4,45}) [-—] (.+)$/s);
  if (m) return { title: m[1].trim(), body: m[2].trim() };
  return { title: '', body: text };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDuration(s: number) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return s % 60 > 0 ? `${m}m ${s % 60}s` : `${m} min`;
}
function fmtDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtTime(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function camelToTitle(k: string) {
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const R = 52, C = 2 * Math.PI * R;
  const offset = C * (1 - Math.min(Math.max(score / 10, 0), 1));
  const tier = getScoreTier(score);
  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0">
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-full opacity-20 blur-xl" style={{ background: tier.strokeColor }} />
      <svg width="140" height="140" viewBox="0 0 120 120" className="-rotate-90" aria-hidden="true">
        {/* Track */}
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="7" />
        {/* Progress arc */}
        <circle
          cx="60" cy="60" r={R} fill="none"
          stroke={tier.strokeColor} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${tier.strokeColor}60)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`text-3xl font-bold leading-none tabular-nums ${tier.color}`}>{score.toFixed(1)}</span>
        <span className="text-[11px] text-slate-600 mt-1 font-medium">/ 10</span>
        <span className={`text-xs font-semibold mt-1 ${tier.color}`}>{tier.label}</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PerformanceDashboard({ report, onExportPDF }: PerformanceDashboardProps) {
  const [tab, setTab] = useState<'score' | 'transcript' | 'feedback'>('score');
  const [feedbackSubTab, setFeedbackSubTab] = useState<'summary' | 'notes'>('summary');
  const [expandedObs, setExpandedObs] = useState<Set<number>>(new Set());
  const [benchmarks, setBenchmarks] = useState<BenchmarkData | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const txFetched = useRef(false);
  const { session } = useSupabaseSession();
  const userAvatarUrl = getUserAvatarUrl(session?.user ?? null);

  // ── Normalize fields ──
  const candidateName = report.candidateName || report.metadata?.candidateName || 'Candidate';
  const rawType = report.interviewType || report.metadata?.interviewType || '';
  const typeKey = labelToKey[rawType] || rawType;
  const displayType = typeDisplayLabels[typeKey] || rawType || 'Technical Interview';
  const timestamp = report.created_at || report.timestamp || report.metadata?.timestamp || '';
  const duration = report.duration ?? (report.metadata?.duration as number) ?? 0;
  const detailedFeedback = report.detailed_feedback || (report as any).detailedFeedback || '';
  const recommendation = (report.recommendation || '').toUpperCase();
  const metrics = report.metadata?.metrics;
  const totalQ = metrics?.totalQuestions ?? 0;
  const codeSubs = metrics?.codeSubmissions ?? 0;
  const sessionId = report.session_id || report.metadata?.sessionId || '';

  const recCfg = getRecConfig(recommendation);
  const overallTier = getScoreTier(report.overallScore);
  const feedbackNotes = parseFeedbackNotes(detailedFeedback);

  // ── Benchmarks ──
  useEffect(() => {
    if (!typeKey) return;
    getBenchmarks(typeKey).then(d => setBenchmarks(d ?? null)).catch(() => setBenchmarks(null));
  }, [typeKey]);

  // ── Transcript (fetch on mount so PDF export always has it) ──
  useEffect(() => {
    if (txFetched.current || !sessionId) return;
    txFetched.current = true;
    setTxLoading(true);
    getTranscript(sessionId)
      .then(d => setTranscript(d?.transcript ?? []))
      .catch(() => setTranscript([]))
      .finally(() => setTxLoading(false));
  }, [sessionId]);

  const percentile = benchmarks?.has_data ? calcPercentile(report.overallScore, benchmarks) : null;

  const radarData = [
    { subject: 'Technical', score: report.scores.technicalKnowledge, fullMark: 10 },
    { subject: 'Problem Solving', score: report.scores.problemSolving, fullMark: 10 },
    { subject: 'Communication', score: report.scores.communication, fullMark: 10 },
    { subject: 'Code Quality', score: report.scores.codeQuality, fullMark: 10 },
    { subject: 'Cultural Fit', score: report.scores.culturalFit, fullMark: 10 },
  ];

  return (
    <div className="bg-[#0d1117] rounded-2xl border border-slate-800/60 overflow-hidden shadow-2xl shadow-black/40">

      {/* ── Header ── */}
      <div className="px-6 py-5 border-b border-slate-800/60 flex items-start justify-between gap-4"
        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.05) 0%, transparent 60%)' }}>
        <div>
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">{candidateName}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20">
              {displayType}
            </span>
            {timestamp && <span className="text-sm text-slate-500">{fmtDate(timestamp)}</span>}
          </div>
        </div>
        {onExportPDF && (
          <button onClick={onExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 rounded-lg transition-all flex-shrink-0">
            <Download className="w-3.5 h-3.5" />Export PDF
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-slate-800/60 overflow-x-auto">
        {([
          { key: 'score', label: 'Performance Score' },
          { key: 'transcript', label: 'Transcript' },
          { key: 'feedback', label: 'Overall Feedback' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap flex-shrink-0 border-b-2 ${
              tab === key
                ? 'text-slate-100 bg-slate-800/50 border-violet-500'
                : 'text-slate-500 hover:text-slate-300 bg-transparent border-transparent hover:bg-slate-800/30'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="p-6">

        {/* ═══════════════════════════════ SCORE TAB ═══════════════════════════════ */}
        <div className={tab !== 'score' ? 'hidden' : ''}>
          <div className="space-y-8">

            {/* Score ring + recommendation + stats */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <ScoreRing score={report.overallScore} />
              <div className="flex flex-col gap-3.5 sm:pt-1 items-center sm:items-start">
                {/* Recommendation badge */}
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${recCfg.classes}`}>
                  <span className={`w-2 h-2 rounded-full ${recCfg.dot}`} />
                  {recCfg.label}
                </div>
                {/* Stats */}
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {duration > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5" />{fmtDuration(duration)}
                    </div>
                  )}
                  {totalQ > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MessageSquare className="w-3.5 h-3.5" />{totalQ} questions
                    </div>
                  )}
                  {codeSubs > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Code2 className="w-3.5 h-3.5" />{codeSubs} submission{codeSubs !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dimension bars + Radar — 2-col on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Dimension bars */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Score Breakdown</p>
                <div className="space-y-4">
                  {Object.entries(report.scores).map(([key, value]) => {
                    const pct = Math.min((value / 10) * 100, 100);
                    const tier = getScoreTier(value);
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-slate-300 font-medium">{camelToTitle(key)}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${tier.badgeClasses}`}>{tier.label}</span>
                            <span className={`text-sm font-bold tabular-nums ${tier.color}`}>{value.toFixed(1)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${pct}%`, backgroundColor: tier.barColor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Radar */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Skill Distribution</p>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
                    <PolarGrid stroke="#1e293b" strokeDasharray="4 4" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#334155', fontSize: 9 }} />
                    <Radar name="Score" dataKey="score"
                      stroke={overallTier.strokeColor} fill={overallTier.radarFill} fillOpacity={0.12}
                      dot={{ fill: overallTier.strokeColor, r: 3, strokeWidth: 0 }} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }}
                      formatter={(v: number) => [`${v.toFixed(1)} / 10`, 'Score']} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Benchmarks */}
            {benchmarks?.has_data && percentile !== null && (
              <div className="border-t border-slate-800/60 pt-6">
                <div className="flex items-center justify-between mb-5">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">How You Compare</p>
                  <span className="text-xs text-slate-600">{benchmarks.sample_size} {displayType} sessions</span>
                </div>
                <div className="flex items-baseline gap-2 mb-5">
                  <span className={`text-4xl font-bold tabular-nums ${overallTier.color}`}>
                    {percentile >= 50 ? `Top ${Math.max(1, 100 - percentile)}%` : `${percentile}th percentile`}
                  </span>
                  <span className="text-sm text-slate-500">of candidates</span>
                </div>
                <div className="relative mb-4">
                  <div className="h-2 bg-slate-800 rounded-full overflow-visible relative">
                    <div className="h-full rounded-full absolute left-0 top-0 transition-all duration-700"
                      style={{ width: `${toPct(report.overallScore, benchmarks.min ?? 0, benchmarks.max ?? 10)}%`, backgroundColor: overallTier.strokeColor, opacity: 0.4 }} />
                    {benchmarks.p50 !== undefined && (
                      <div className="absolute top-0 h-2 w-px bg-slate-500/70"
                        style={{ left: `${toPct(benchmarks.p50, benchmarks.min ?? 0, benchmarks.max ?? 10)}%` }} />
                    )}
                    <div className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-[#0d1117] shadow-lg"
                      style={{ left: `${toPct(report.overallScore, benchmarks.min ?? 0, benchmarks.max ?? 10)}%`, transform: 'translate(-50%,-50%)', backgroundColor: overallTier.strokeColor }} />
                  </div>
                  <div className="flex justify-between mt-3 text-xs text-slate-600">
                    <span>{(benchmarks.min ?? 0).toFixed(1)}</span>
                    {benchmarks.p50 !== undefined && <span className="text-slate-500">Avg {benchmarks.p50.toFixed(1)}</span>}
                    <span>{(benchmarks.max ?? 10).toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'p25', value: benchmarks.p25 }, { label: 'Median', value: benchmarks.p50 },
                    { label: 'p75', value: benchmarks.p75 }, { label: 'p90', value: benchmarks.p90 },
                    { label: 'Your score', value: report.overallScore, hi: true },
                  ].filter(x => x.value !== undefined).map(({ label, value, hi }) => (
                    <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/50 rounded-lg border border-slate-700/40">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className={`text-xs font-semibold ${hi ? overallTier.color : 'text-slate-200'}`}>{(value as number).toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════ TRANSCRIPT TAB ═══════════════════════════════ */}
        <div className={tab !== 'transcript' ? 'hidden' : ''}>
          <div>
            {!sessionId ? (
              <div className="py-16 text-center">
                <p className="text-slate-400 font-medium">Transcript unavailable</p>
                <p className="text-sm text-slate-600 mt-1">No session ID found for this report.</p>
              </div>
            ) : txLoading ? (
              <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                <span className="text-sm">Loading transcript…</span>
              </div>
            ) : transcript.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl">
                <p className="text-sm text-slate-500">No transcript available for this session.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {transcript.map((msg, i) => {
                  const isAI = msg.role === 'assistant';
                  return (
                    <div key={i} className={`flex gap-3 ${isAI ? '' : 'flex-row-reverse'}`}>
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-0.5 ring-1 ring-slate-700/40">
                        {isAI ? (
                          <img src="/women-icon.svg" alt="Neerja" className="w-full h-full object-cover" />
                        ) : userAvatarUrl ? (
                          <img src={userAvatarUrl} alt={candidateName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                            {candidateName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className={`flex flex-col gap-1.5 max-w-[78%] ${isAI ? 'items-start' : 'items-end'}`}>
                        <span className="text-[10px] text-slate-500 px-1">
                          {isAI ? 'Neerja' : candidateName}
                          {' · '}
                          {fmtTime(msg.timestamp)}
                        </span>
                        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          isAI
                            ? 'bg-slate-800/60 text-slate-300 rounded-tl-sm border border-slate-700/40'
                            : 'bg-violet-600/15 text-violet-100 rounded-tr-sm border border-violet-500/20'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════ FEEDBACK TAB ═══════════════════════════════ */}
        <div className={tab !== 'feedback' ? 'hidden' : ''}>
          <div className="space-y-5">

            {/* Recommendation */}
            <div className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold ${recCfg.classes}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${recCfg.dot}`} />
              {recCfg.label}
            </div>

            {/* Feedback sub-tabs */}
            <div className="flex gap-1 bg-slate-800/40 rounded-lg p-1 w-fit">
              {(['summary', 'notes'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setFeedbackSubTab(st)}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    feedbackSubTab === st
                      ? 'bg-slate-700 text-slate-100'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {st === 'summary' ? 'Summary' : "Interviewer's Notes"}
                </button>
              ))}
            </div>

            {/* Summary sub-tab */}
            <div className={feedbackSubTab !== 'summary' ? 'hidden' : ''}>
              <div className="space-y-5">
                {report.strengths.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Strengths</p>
                    <div className="space-y-2">
                      {report.strengths.map((s, i) => {
                        const { title, body } = parseFeedbackItem(s);
                        return (
                          <div key={i} className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-slate-700/40 bg-slate-800/30">
                            <div className="w-5 h-5 rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-emerald-400 text-[9px] font-bold">✓</span>
                            </div>
                            <div className="min-w-0">
                              {title && <p className="text-sm font-semibold text-slate-100 leading-snug">{title}</p>}
                              <p className="text-sm text-slate-400 leading-relaxed mt-0.5">{body}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {report.improvements.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Areas to Improve</p>
                    <div className="space-y-2">
                      {report.improvements.map((imp, i) => {
                        const { title, body } = parseFeedbackItem(imp);
                        return (
                          <div key={i} className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-slate-700/40 bg-slate-800/30">
                            <div className="w-5 h-5 rounded-full bg-slate-700/60 ring-1 ring-slate-600/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Minus className="w-3 h-3 text-slate-400" />
                            </div>
                            <div className="min-w-0">
                              {title && <p className="text-sm font-semibold text-slate-100 leading-snug">{title}</p>}
                              <p className="text-sm text-slate-400 leading-relaxed mt-0.5">{body}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {report.strengths.length === 0 && report.improvements.length === 0 && (
                  <p className="text-sm text-slate-600 italic">No feedback available.</p>
                )}
              </div>
            </div>

            {/* Interviewer's Notes sub-tab */}
            <div className={feedbackSubTab !== 'notes' ? 'hidden' : ''}>
              <div className="space-y-3">
                {!feedbackNotes ? (
                  <p className="text-sm text-slate-600 italic">No interviewer notes available.</p>
                ) : (
                  <>
                    {feedbackNotes.bottom_line && (
                      <div className="px-4 py-4 rounded-xl border border-slate-700/30 bg-slate-800/20"
                        style={{ borderLeft: `3px solid ${overallTier.strokeColor}` }}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: overallTier.strokeColor }}>
                          Bottom Line
                        </p>
                        <p className="text-sm text-slate-300 leading-relaxed">{feedbackNotes.bottom_line.replace(/\s*—\s*/g, ' ')}</p>
                      </div>
                    )}

                    {feedbackNotes.observations.length > 0 && (
                      <div className="space-y-1.5">
                        {feedbackNotes.observations.map((obs, i) => {
                          const open = expandedObs.has(i);
                          return (
                            <div key={i} className="rounded-xl border border-slate-700/40 bg-slate-800/20 overflow-hidden">
                              <button
                                onClick={() => setExpandedObs(prev => {
                                  const next = new Set(prev);
                                  open ? next.delete(i) : next.add(i);
                                  return next;
                                })}
                                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-800/40 transition-colors"
                              >
                                <p className="text-sm font-semibold text-slate-100 leading-snug">{obs.title.replace(/\s*—\s*/g, ' ')}</p>
                                <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 ml-3 transition-transform ${open ? 'rotate-180' : ''}`} />
                              </button>
                              {open && (
                                <div className="px-4 pb-4 border-t border-slate-700/30">
                                  <p className="text-sm text-slate-400 leading-relaxed pt-3">{obs.body.replace(/\s*—\s*/g, ' ')}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
