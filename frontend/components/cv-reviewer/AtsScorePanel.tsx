'use client';

import { useState, useEffect } from 'react';
import type { ElementType } from 'react';
import {
  Bot, AlertCircle, CheckCircle2, XCircle, ChevronDown,
  Target, Zap, BookOpen, Briefcase, GraduationCap, Layout,
} from 'lucide-react';
import type { ScoreResult, Suggestion, StructuredSuggestion } from './types';
import type { CVAnalysis } from './types';
import { getCvAiSuggestions } from '@/lib/api';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface AtsScorePanelProps {
  atsResults: ScoreResult[];
  analysis: CVAnalysis;
  sessionId?: string;
  jobDescription?: string;
  // Page-level cache: keyed by sessionId so suggestions survive re-opens
  suggestionsCache?: Map<string, StructuredSuggestion[]>;
  onSuggestionsCached?: (sessionId: string, items: StructuredSuggestion[]) => void;
}

// ─── Count-up animation ────────────────────────────────────────────────────────

// resetKey forces restart even when numeric target hasn't changed
// (e.g. Workday=84 → Taleo=84 — same score, different platform)
function useCountUp(target: number, duration = 1000, resetKey?: string) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(0);
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, resetKey]);
  return value;
}

// ─── Platform palette ──────────────────────────────────────────────────────────

const PLATFORMS: Record<string, { short: string; color: string; glow: string }> = {
  Workday:        { short: 'Workday',    color: '#60a5fa', glow: 'rgba(96,165,250,0.14)' },
  Taleo:          { short: 'Taleo',      color: '#a78bfa', glow: 'rgba(167,139,250,0.14)' },
  SuccessFactors: { short: 'SAP SF',     color: '#fb923c', glow: 'rgba(251,146,60,0.14)' },
  iCIMS:          { short: 'iCIMS',      color: '#2dd4bf', glow: 'rgba(45,212,191,0.14)' },
  Greenhouse:     { short: 'Greenhouse', color: '#4ade80', glow: 'rgba(74,222,128,0.14)' },
  Lever:          { short: 'Lever',      color: '#f472b6', glow: 'rgba(244,114,182,0.14)' },
};

const getPlatform = (name: string) =>
  PLATFORMS[name] ?? { short: name, color: '#94a3b8', glow: 'rgba(148,163,184,0.08)' };

// ─── Score health colours ──────────────────────────────────────────────────────

const healthColor = (s: number) => s >= 80 ? '#34d399' : s >= 60 ? '#fbbf24' : '#f87171';
const healthTextClass = (s: number) =>
  s >= 80 ? 'text-emerald-400' : s >= 60 ? 'text-amber-400' : 'text-red-400';

// ─── Score Arc ─────────────────────────────────────────────────────────────────

function ScoreArc({ score, passes, color, resetKey }: { score: number; passes: boolean; color: string; resetKey: string }) {
  const d = useCountUp(score, 1100, resetKey);
  const r = 50;
  const c = 2 * Math.PI * r;
  const offset = c - (d / 100) * c;
  const gid = `arc-${resetKey.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <div className="flex flex-col items-center gap-2 flex-shrink-0">
      <div className="relative w-[118px] h-[118px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 116 116">
          <defs>
            <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle cx="58" cy="58" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
          {/* Glow layer */}
          <circle
            cx="58" cy="58" r={r} fill="none"
            stroke={color} strokeWidth="10" opacity="0.12"
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            style={{ filter: `blur(4px)`, transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
          {/* Arc */}
          <circle
            cx="58" cy="58" r={r} fill="none"
            stroke={`url(#${gid})`} strokeWidth="10"
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${color}60)`,
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] font-black tabular-nums leading-none" style={{ color }}>{d}</span>
          <span className="text-[9px] text-slate-600 font-medium mt-0.5">/ 100</span>
        </div>
      </div>
      <span
        className={`flex items-center gap-1 text-[10px] font-semibold rounded-full px-2.5 py-0.5 ${
          passes
            ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
            : 'text-red-300 bg-red-500/10 border border-red-500/20'
        }`}
      >
        {passes ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
        {passes ? 'Passes Filter' : 'Filtered Out'}
      </span>
    </div>
  );
}

// ─── Platform Tab ──────────────────────────────────────────────────────────────

function PlatformTab({ result, isActive, onClick }: {
  result: ScoreResult;
  isActive: boolean;
  onClick: () => void;
}) {
  const p = getPlatform(result.system);
  const d = useCountUp(result.overallScore, 700);

  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl transition-all duration-150"
      style={
        isActive
          ? {
              background: `${p.color}12`,
              border: `1px solid ${p.color}35`,
              boxShadow: `0 0 16px ${p.glow}`,
            }
          : {
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
            }
      }
    >
      <span
        className="text-[9px] font-bold uppercase tracking-wide"
        style={{ color: isActive ? p.color : '#475569' }}
      >
        {p.short}
      </span>
      <span
        className="text-[15px] font-black tabular-nums leading-snug"
        style={{ color: isActive ? p.color : '#334155' }}
      >
        {d}
      </span>
      <span className={`text-[9px] font-medium ${result.passesFilter ? 'text-emerald-400' : 'text-rose-400'}`}>
        {result.passesFilter ? '✓ pass' : '✗ fail'}
      </span>
    </button>
  );
}

// ─── Platform weights lookup (for weight indicator on each bar) ───────────────

type DimKey = 'formatting' | 'keywords' | 'sections' | 'experience' | 'education';
const PLATFORM_WEIGHTS: Record<string, Record<DimKey, number>> = {
  Workday:        { formatting: 0.25, keywords: 0.30, sections: 0.15, experience: 0.15, education: 0.10 },
  Taleo:          { formatting: 0.20, keywords: 0.35, sections: 0.15, experience: 0.20, education: 0.10 },
  SuccessFactors: { formatting: 0.20, keywords: 0.30, sections: 0.15, experience: 0.20, education: 0.15 },
  iCIMS:          { formatting: 0.15, keywords: 0.30, sections: 0.15, experience: 0.25, education: 0.15 },
  Greenhouse:     { formatting: 0.10, keywords: 0.25, sections: 0.10, experience: 0.25, education: 0.10 },
  Lever:          { formatting: 0.08, keywords: 0.22, sections: 0.10, experience: 0.30, education: 0.10 },
};

const DIM_KEY_MAP: Record<string, DimKey> = {
  Formatting: 'formatting', Keywords: 'keywords', Sections: 'sections',
  Experience: 'experience', Education: 'education',
};

// ─── Dimension Row — health-coloured bars ─────────────────────────────────────

const DIM_ICONS: Partial<Record<string, ElementType>> = {
  Formatting: Layout,
  Keywords:   Target,
  Sections:   BookOpen,
  Experience: Briefcase,
  Education:  GraduationCap,
};

function DimensionRow({ label, score, resetKey, system }: { label: string; score: number; resetKey: string; system: string }) {
  const d = useCountUp(score, 1100, resetKey);
  const Icon = DIM_ICONS[label] ?? Target;
  const color = healthColor(score);
  const weight = PLATFORM_WEIGHTS[system]?.[DIM_KEY_MAP[label] ?? 'formatting'];

  return (
    <div className="flex items-center gap-2.5">
      <Icon size={10} className="text-slate-700 flex-shrink-0" />
      <span className="text-[10px] text-slate-500 w-[76px] flex-shrink-0 leading-none">{label}</span>
      <div className="flex-1 h-[5px] rounded-full overflow-hidden bg-white/[0.04]">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${d}%`,
            background: `linear-gradient(90deg, ${color}50, ${color})`,
            boxShadow: `0 0 5px ${color}40`,
          }}
        />
      </div>
      <span className={`text-[10px] font-bold tabular-nums w-6 text-right flex-shrink-0 ${healthTextClass(score)}`}>
        {d}
      </span>
      {weight != null && (
        <span className="text-[8px] text-slate-700 w-7 text-right flex-shrink-0 font-medium tabular-nums">
          {Math.round(weight * 100)}%
        </span>
      )}
    </div>
  );
}

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label }: { icon: ElementType; label: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-3">
      <Icon size={9} />
      {label}
    </p>
  );
}

// ─── Keyword chips ─────────────────────────────────────────────────────────────

function KeywordChips({ matched, missing, synonymMatched }: {
  matched: string[];
  missing: string[];
  synonymMatched: string[];
}) {
  if (!matched.length && !missing.length && !synonymMatched.length) return null;

  return (
    <div className="space-y-3">
      {matched.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-widest mb-1.5">
            Matched · {matched.length}
          </p>
          <div className="flex flex-wrap gap-1">
            {matched.slice(0, 14).map((k) => (
              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-md text-emerald-300 bg-emerald-500/8 border border-emerald-500/15">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
      {synonymMatched.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold text-sky-600 uppercase tracking-widest mb-1.5">
            Synonym · {synonymMatched.length}
          </p>
          <div className="flex flex-wrap gap-1">
            {synonymMatched.slice(0, 8).map((k) => (
              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-md text-sky-300 bg-sky-500/8 border border-sky-500/15">
                ~{k}
              </span>
            ))}
          </div>
        </div>
      )}
      {missing.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold text-rose-600 uppercase tracking-widest mb-1.5">
            Missing · {missing.length}
          </p>
          <div className="flex flex-wrap gap-1">
            {missing.slice(0, 10).map((k) => (
              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-md text-rose-300 bg-rose-500/8 border border-rose-500/15">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Suggestion card ───────────────────────────────────────────────────────────

const IMPACT_CFG: Record<string, { label: string; color: string; dimBg: string }> = {
  critical: { label: 'CRITICAL', color: '#f87171', dimBg: 'rgba(248,113,113,0.07)' },
  high:     { label: 'HIGH',     color: '#fb923c', dimBg: 'rgba(251,146,60,0.07)'  },
  medium:   { label: 'MEDIUM',   color: '#fbbf24', dimBg: 'rgba(251,191,36,0.06)'  },
  low:      { label: 'LOW',      color: '#64748b', dimBg: 'rgba(100,116,139,0.05)' },
};

function SuggestionCard({ item, index }: { item: StructuredSuggestion; index: number }) {
  const [open, setOpen] = useState(false);
  const cfg = IMPACT_CFG[item.impact] ?? IMPACT_CFG.low;
  // Hard-cap title at 12 words regardless of LLM output
  const words = item.summary.split(' ');
  const title = words.length > 12 ? words.slice(0, 12).join(' ') + '...' : item.summary;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-150"
      style={{
        border: `1px solid ${open ? `${cfg.color}22` : 'rgba(255,255,255,0.07)'}`,
      }}
    >
      {/* ── Collapsed row ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors group"
      >
        {/* Impact-coloured number circle */}
        <span
          className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 text-white"
          style={{ background: cfg.color, opacity: 0.9 }}
        >
          {index + 1}
        </span>
        {/* Title — single line, max 12 words */}
        <p className="flex-1 min-w-0 text-[10px] text-slate-300 font-medium leading-tight truncate group-hover:text-slate-200 transition-colors">
          {title}
        </p>
        {/* Impact badge + chevron */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="text-[8px] font-black tracking-wide px-1.5 py-[3px] rounded-md"
            style={{
              color: cfg.color,
              background: `${cfg.color}15`,
              border: `1px solid ${cfg.color}35`,
            }}
          >
            {cfg.label}
          </span>
          {item.details.length > 0 && (
            <ChevronDown
              size={11}
              className="text-slate-500 flex-shrink-0 transition-transform duration-200"
              style={{ transform: open ? 'rotate(180deg)' : undefined }}
            />
          )}
        </div>
      </button>

      {/* ── Expanded description ── */}
      {open && item.details.length > 0 && (
        <div
          className="px-4 pb-4"
          style={{
            borderTop: `1px solid ${cfg.color}18`,
            background: `${cfg.color}06`,
          }}
        >
          <div className="space-y-3 pt-3">
            {item.details.map((d, i) => (
              <p key={i} className="flex items-start gap-2.5 text-[10.5px] text-slate-400 leading-relaxed">
                <span
                  className="w-[5px] h-[5px] rounded-full flex-shrink-0 mt-[5px]"
                  style={{ background: cfg.color, opacity: 0.8 }}
                />
                {d}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI Summary ────────────────────────────────────────────────────────────────

function AISummary({ analysis }: { analysis: CVAnalysis }) {
  const text = analysis.summary?.trim();
  if (!text) return null;

  // Split into sentences for structured visual presentation
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 10);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(139,92,246,0.12)' }}>
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.10) 0%, rgba(59,130,246,0.05) 100%)',
          borderBottom: '1px solid rgba(139,92,246,0.08)',
        }}
      >
        <div className="w-5 h-5 rounded-md bg-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Bot size={10} className="text-violet-400" />
        </div>
        <span className="text-[10px] font-bold text-violet-400/70 uppercase tracking-widest">AI Analysis</span>
      </div>
      {/* Body */}
      <div className="px-4 py-3" style={{ background: 'rgba(8,10,20,0.85)' }}>
        {sentences.length > 1 ? (
          <div className="space-y-2">
            {sentences.map((s, i) => (
              <p key={i} className="flex items-start gap-2.5 text-[11px] text-slate-400 leading-relaxed">
                <span className="w-[4px] h-[4px] rounded-full bg-violet-500/50 flex-shrink-0 mt-[6px]" />
                {s}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 leading-relaxed">{text}</p>
        )}
      </div>
    </div>
  );
}

// ─── Thin divider ──────────────────────────────────────────────────────────────

function Divider() {
  return <div className="h-px bg-white/[0.04] mx-4" />;
}

// ─── Root component ────────────────────────────────────────────────────────────

export default function AtsScorePanel({
  atsResults, analysis, sessionId, jobDescription,
  suggestionsCache, onSuggestionsCached,
}: AtsScorePanelProps) {
  const initBest =
    atsResults && atsResults.length > 0
      ? atsResults.reduce((b, r) => (r.overallScore > b.overallScore ? r : b), atsResults[0]).system
      : '';

  const [selected, setSelected] = useState<string>(initBest);
  // null = loading, [] = failed/empty (show deterministic), non-empty = ready
  const [aiSuggestions, setAiSuggestions] = useState<StructuredSuggestion[] | null>(() =>
    sessionId && suggestionsCache?.has(sessionId) ? suggestionsCache.get(sessionId)! : null
  );

  useEffect(() => {
    if (!atsResults?.length) return;
    const best = atsResults.reduce((b, r) => (r.overallScore > b.overallScore ? r : b), atsResults[0]);
    setSelected(best.system);
  }, [atsResults]);

  // Fetch AI suggestions — skip if already cached for this sessionId
  useEffect(() => {
    if (!sessionId || !atsResults?.length) return;
    // Already have cached result — don't re-fetch
    if (suggestionsCache?.has(sessionId)) {
      setAiSuggestions(suggestionsCache.get(sessionId)!);
      return;
    }
    let cancelled = false;
    setAiSuggestions(null);

    const avg = Math.round(atsResults.reduce((s, r) => s + r.overallScore, 0) / atsResults.length);
    getCvAiSuggestions(sessionId, avg, jobDescription)
      .then((data) => {
        if (!cancelled) {
          const items = (data.suggestions ?? []).map((s): StructuredSuggestion => ({
            summary: s.summary,
            details: s.details ?? [],
            impact: (s.impact as StructuredSuggestion['impact']) ?? 'medium',
            platforms: s.platforms ?? [],
          }));
          setAiSuggestions(items);
          onSuggestionsCached?.(sessionId, items);
        }
      })
      .catch(() => {
        if (!cancelled) setAiSuggestions([]);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Guard after hooks
  if (!atsResults || atsResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-800/60 p-10">
        <AlertCircle size={18} className="text-slate-700" />
        <p className="text-[11px] text-slate-600">No ATS scores available.</p>
      </div>
    );
  }

  const active = atsResults.find((r) => r.system === selected) ?? atsResults[0];
  const p = getPlatform(active.system);
  const { breakdown } = active;

  const passCount = atsResults.filter((r) => r.passesFilter).length;
  const avg = Math.round(atsResults.reduce((s, r) => s + r.overallScore, 0) / atsResults.length);

  // Normalise suggestions and sort by priority: critical → high → medium → low
  const PRIORITY: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  // Deterministic fallback suggestions (per active platform)
  const deterministicSuggestions: StructuredSuggestion[] = (active.suggestions ?? [])
    .slice(0, 6)
    .map((s): StructuredSuggestion =>
      typeof s === 'string' ? { summary: s, details: [], impact: 'medium', platforms: [] } : s
    )
    .sort((a, b) => (PRIORITY[a.impact] ?? 2) - (PRIORITY[b.impact] ?? 2));

  // Use AI suggestions when loaded, fall back to deterministic
  const isAiLoading = sessionId != null && aiSuggestions === null;
  const displaySuggestions = aiSuggestions?.length
    ? aiSuggestions
    : deterministicSuggestions;

  const hasKeywords =
    breakdown.keywordMatch.matched.length > 0 ||
    breakdown.keywordMatch.missing.length > 0 ||
    breakdown.keywordMatch.synonymMatched.length > 0;

  return (
    <div className="space-y-3">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between px-0.5">
        <div>
          <p className="text-xs font-bold text-slate-100 tracking-tight">ATS Compatibility</p>
          <p
            className={`text-[10px] mt-0.5 font-medium ${
              passCount === atsResults.length
                ? 'text-emerald-400'
                : passCount >= 4
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {passCount}/{atsResults.length} platforms pass
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">Avg score</p>
          <p className={`text-xl font-black tabular-nums leading-none ${healthTextClass(avg)}`}>{avg}</p>
        </div>
      </div>

      {/* ── Platform tabs ───────────────────────────────────────────────── */}
      <div className="flex gap-1.5">
        {atsResults.map((r) => (
          <PlatformTab
            key={r.system}
            result={r}
            isActive={r.system === selected}
            onClick={() => setSelected(r.system)}
          />
        ))}
      </div>

      {/* ── Detail card — key forces remount on platform switch ───────── */}
      <div
        key={active.system}
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(10,15,30,0.98) 0%, rgba(4,8,20,1) 100%)',
          border: `1px solid ${p.color}28`,
          boxShadow: `0 0 28px ${p.glow}`,
        }}
      >

        {/* Score ring + platform info + dimension bars */}
        <div className="flex items-start gap-4 p-4">
          <ScoreArc score={active.overallScore} passes={active.passesFilter} color={p.color} resetKey={active.system} />
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm font-bold text-white leading-none">{active.system}</p>
            <p className="text-[10px] text-slate-600 mt-0.5 mb-4">{active.vendor}</p>
            <div className="space-y-[9px]">
              <DimensionRow label="Formatting"  score={breakdown.formatting.score}  resetKey={active.system} system={active.system} />
              <DimensionRow label="Keywords"    score={breakdown.keywordMatch.score} resetKey={active.system} system={active.system} />
              <DimensionRow label="Sections"    score={breakdown.sections.score}     resetKey={active.system} system={active.system} />
              <DimensionRow label="Experience"  score={breakdown.experience.score}   resetKey={active.system} system={active.system} />
              <DimensionRow label="Education"   score={breakdown.education.score}    resetKey={active.system} system={active.system} />
            </div>
          </div>
        </div>

        {/* Keywords */}
        {hasKeywords && (
          <>
            <Divider />
            <div className="px-4 py-3.5">
              <SectionLabel icon={Target} label="Keywords" />
              <KeywordChips
                matched={breakdown.keywordMatch.matched}
                missing={breakdown.keywordMatch.missing}
                synonymMatched={breakdown.keywordMatch.synonymMatched}
              />
            </div>
          </>
        )}

        {/* Formatting issues */}
        {breakdown.formatting.issues.length > 0 && (
          <>
            <Divider />
            <div className="px-4 py-3.5">
              <SectionLabel icon={AlertCircle} label="Formatting Issues" />
              <div className="space-y-1.5">
                {breakdown.formatting.issues.map((iss, i) => (
                  <p key={i} className="text-[10px] text-amber-400/80 flex items-start gap-2">
                    <span className="text-amber-600 flex-shrink-0 mt-0.5">›</span>
                    {iss}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Suggestions */}
        {(displaySuggestions.length > 0 || isAiLoading) && (
          <>
            <Divider />
            <div className="px-4 py-3.5">
              {/* Section header */}
              <div className="flex items-center gap-2 mb-3">
                <Zap size={10} className="text-amber-400/50" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Suggestions
                </span>
                {isAiLoading && (
                  <span className="flex items-center gap-1.5 text-[9px] text-slate-600 ml-1">
                    <span className="w-2.5 h-2.5 border border-slate-700 border-t-slate-500 rounded-full animate-spin inline-block" />
                    analyzing...
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {displaySuggestions.map((s, i) => (
                  <SuggestionCard key={i} item={s} index={i} />
                ))}
              </div>
            </div>
          </>
        )}

      </div>

      {/* ── AI Summary ─────────────────────────────────────────────────── */}
      <AISummary analysis={analysis} />

    </div>
  );
}
