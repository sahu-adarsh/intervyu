'use client';

import { useState, useEffect } from 'react';
import { Bot, Lightbulb, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import type { ScoreResult, Suggestion, StructuredSuggestion } from './types';
import type { CVAnalysis } from './types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AtsScorePanelProps {
  atsResults: ScoreResult[];
  analysis: CVAnalysis;
}

// ─── Animation hook ───────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1000) {
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

// ─── Platform color palette ───────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, { accent: string; bg: string; ring: string; text: string }> = {
  Workday:       { accent: '#60a5fa', bg: 'bg-blue-500/10',    ring: 'ring-blue-500/50',    text: 'text-blue-300' },
  Taleo:         { accent: '#a78bfa', bg: 'bg-violet-500/10',  ring: 'ring-violet-500/50',  text: 'text-violet-300' },
  SuccessFactors:{ accent: '#f97316', bg: 'bg-orange-500/10',  ring: 'ring-orange-500/50',  text: 'text-orange-300' },
  iCIMS:         { accent: '#34d399', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/50', text: 'text-emerald-300' },
  Greenhouse:    { accent: '#4ade80', bg: 'bg-green-500/10',   ring: 'ring-green-500/50',   text: 'text-green-300' },
  Lever:         { accent: '#fb7185', bg: 'bg-rose-500/10',    ring: 'ring-rose-500/50',    text: 'text-rose-300' },
};

function getPlatformColor(name: string) {
  return PLATFORM_COLORS[name] ?? { accent: '#94a3b8', bg: 'bg-slate-500/10', ring: 'ring-slate-500/50', text: 'text-slate-300' };
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, passes, accent }: { score: number; passes: boolean; accent: string }) {
  const r = 48;
  const circ = 2 * Math.PI * r;
  const displayed = useCountUp(score);
  const offset = circ - (displayed / 100) * circ;
  const gradId = `sg-${score}-${accent.replace('#', '')}`;

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 110 110">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.9" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.5" />
            </linearGradient>
          </defs>
          <circle cx="55" cy="55" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
          <circle cx="55" cy="55" r={r} fill="none"
            stroke={`url(#${gradId})`} strokeWidth="10"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" opacity="0.15"
            style={{ filter: 'blur(3px)', transition: 'stroke-dashoffset 1s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
          <circle cx="55" cy="55" r={r} fill="none"
            stroke={`url(#${gradId})`} strokeWidth="10"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-white leading-none tabular-nums">{displayed}</span>
          <span className="text-[10px] text-slate-500 mt-0.5">/ 100</span>
        </div>
      </div>
      {passes ? (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
          <CheckCircle2 size={9} /> Passes Filter
        </span>
      ) : (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
          <XCircle size={9} /> Filtered Out
        </span>
      )}
    </div>
  );
}

// ─── Platform Pill ────────────────────────────────────────────────────────────

function PlatformPill({
  result,
  isActive,
  onClick,
}: {
  result: ScoreResult;
  isActive: boolean;
  onClick: () => void;
}) {
  const { bg, ring, text, accent } = getPlatformColor(result.system);
  const displayed = useCountUp(result.overallScore, 800);
  const shortName = result.system === 'SuccessFactors' ? 'SAP SF' : result.system;

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border transition-all duration-150 min-w-[68px] ${
        isActive
          ? `${bg} ring-1 ${ring} border-transparent`
          : 'bg-slate-800/50 border-slate-700/40 hover:bg-slate-800'
      }`}
    >
      <span className={`text-[10px] font-semibold ${isActive ? text : 'text-slate-400'} leading-tight`}>
        {shortName}
      </span>
      <span
        className="text-sm font-black tabular-nums"
        style={{ color: isActive ? accent : '#94a3b8' }}
      >
        {displayed}
      </span>
      <span className={`text-[9px] ${result.passesFilter ? 'text-emerald-400' : 'text-red-400'}`}>
        {result.passesFilter ? '✓ pass' : '✗ fail'}
      </span>
    </button>
  );
}

// ─── Dimension Bar ────────────────────────────────────────────────────────────

function DimensionBar({ label, score, accent }: { label: string; score: number; accent: string }) {
  const displayed = useCountUp(score, 900);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="text-[11px] font-semibold text-slate-300 tabular-nums">{displayed}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-700/60 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${displayed}%`, backgroundColor: accent, opacity: 0.85 }}
        />
      </div>
    </div>
  );
}

// ─── Keyword Section ──────────────────────────────────────────────────────────

function KeywordSection({
  matched,
  missing,
  synonymMatched,
}: {
  matched: string[];
  missing: string[];
  synonymMatched: string[];
}) {
  const hasAny = matched.length > 0 || missing.length > 0 || synonymMatched.length > 0;
  if (!hasAny) return null;

  return (
    <div className="px-4 pb-4 space-y-2.5 border-t border-slate-800 pt-3">
      {matched.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-emerald-400 mb-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Matched ({matched.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {matched.slice(0, 15).map((k) => (
              <span key={k} className="px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-800/40 text-emerald-300 text-[10px]">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
      {synonymMatched.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-blue-400 mb-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            Synonym Match ({synonymMatched.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {synonymMatched.slice(0, 8).map((k) => (
              <span key={k} className="px-1.5 py-0.5 rounded bg-blue-900/30 border border-blue-800/40 text-blue-300 text-[10px]">
                ~{k}
              </span>
            ))}
          </div>
        </div>
      )}
      {missing.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-amber-400 mb-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            Missing ({missing.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {missing.slice(0, 10).map((k) => (
              <span key={k} className="px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-800/40 text-amber-300 text-[10px]">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Impact config ────────────────────────────────────────────────────────────

const IMPACT_CONFIG = {
  critical: { label: 'CRITICAL', badge: 'bg-red-500/20 text-red-400 border-red-500/30',    num: 'bg-red-500 text-white' },
  high:     { label: 'HIGH',     badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30', num: 'bg-orange-500 text-white' },
  medium:   { label: 'MEDIUM',   badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',   num: 'bg-amber-500 text-white' },
  low:      { label: 'LOW',      badge: 'bg-slate-600/40 text-slate-400 border-slate-600/40',   num: 'bg-slate-600 text-slate-300' },
} as const;

// ─── Suggestion Item ──────────────────────────────────────────────────────────

function SuggestionItem({ item, index }: { item: StructuredSuggestion; index: number }) {
  const [open, setOpen] = useState(false);
  const cfg = IMPACT_CONFIG[item.impact] ?? IMPACT_CONFIG.low;

  return (
    <div className="rounded-xl border border-slate-700/50 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-800/60 transition-colors"
      >
        {/* Number badge */}
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${cfg.num}`}>
          {index + 1}
        </span>
        {/* Summary */}
        <span className="text-[11px] text-slate-300 leading-snug flex-1 min-w-0">{item.summary}</span>
        {/* Impact badge */}
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${cfg.badge}`}>
          {cfg.label}
        </span>
        {/* Chevron */}
        <ChevronDown
          size={11}
          className={`text-slate-600 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/50 bg-slate-900/40 space-y-1.5">
          {item.details.map((d, i) => (
            <p key={i} className="text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
              <span className="text-slate-600 mt-0.5 flex-shrink-0">·</span>
              {d}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Suggestions List ─────────────────────────────────────────────────────────

function SuggestionsList({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) return null;

  // Normalise to StructuredSuggestion (handle legacy plain strings gracefully)
  const items: StructuredSuggestion[] = suggestions.slice(0, 6).map((s) =>
    typeof s === 'string'
      ? { summary: s, details: [], impact: 'medium' as const, platforms: [] }
      : s
  );

  return (
    <div className="px-4 pb-4 border-t border-slate-800 pt-3">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
        <Lightbulb size={10} className="text-amber-400" />
        Suggestions
      </p>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <SuggestionItem key={i} item={item} index={i} />
        ))}
      </div>
    </div>
  );
}

// ─── AI Summary ──────────────────────────────────────────────────────────────

function AISummary({ analysis }: { analysis: CVAnalysis }) {
  const summary = analysis.summary?.trim();
  if (!summary) return null;

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Bot size={12} className="text-violet-400" />
        <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">AI Summary</p>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{summary}</p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function AtsScorePanel({ atsResults, analysis }: AtsScorePanelProps) {
  // Guard: nothing to show yet
  if (!atsResults || atsResults.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-6 flex items-center justify-center">
        <p className="text-xs text-slate-500">No ATS scores available.</p>
      </div>
    );
  }

  // Default to highest-scoring platform
  const bestResult = atsResults.reduce((best, r) =>
    r.overallScore > best.overallScore ? r : best
  , atsResults[0]);

  const [selectedSystem, setSelectedSystem] = useState(bestResult.system);

  // Re-default when results change (e.g. new resume loaded)
  useEffect(() => {
    const best = atsResults.reduce((b, r) => r.overallScore > b.overallScore ? r : b, atsResults[0]);
    setSelectedSystem(best.system);
  }, [atsResults]);

  const activeResult = atsResults.find((r) => r.system === selectedSystem) ?? atsResults[0];
  const { accent } = getPlatformColor(activeResult.system);
  const { breakdown } = activeResult;

  const passCount = atsResults.filter((r) => r.passesFilter).length;

  return (
    <div className="space-y-3">

      {/* ── Header summary ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-200">ATS Compatibility</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {passCount}/{atsResults.length} platforms pass
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500">Avg score</p>
          <p className="text-sm font-black text-slate-200 tabular-nums">
            {Math.round(atsResults.reduce((s, r) => s + r.overallScore, 0) / atsResults.length)}
          </p>
        </div>
      </div>

      {/* ── Platform pills ── */}
      <div className="flex gap-1.5 flex-wrap">
        {atsResults.map((r) => (
          <PlatformPill
            key={r.system}
            result={r}
            isActive={r.system === selectedSystem}
            onClick={() => setSelectedSystem(r.system)}
          />
        ))}
      </div>

      {/* ── Active platform detail card ── */}
      <div className="rounded-2xl border border-slate-700/50 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgb(15,23,42) 0%, rgb(20,27,48) 50%, rgb(15,23,42) 100%)' }}>

        {/* Platform header */}
        <div className="p-4 flex items-start gap-4 border-b border-slate-800">
          <ScoreRing
            score={activeResult.overallScore}
            passes={activeResult.passesFilter}
            accent={accent}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{activeResult.system}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 mb-3">{activeResult.vendor}</p>

            {/* Dimension bars */}
            <div className="space-y-2">
              <DimensionBar label="Formatting"  score={breakdown.formatting.score}  accent={accent} />
              <DimensionBar label="Keywords"    score={breakdown.keywordMatch.score} accent={accent} />
              <DimensionBar label="Sections"    score={breakdown.sections.score}     accent={accent} />
              <DimensionBar label="Experience"  score={breakdown.experience.score}   accent={accent} />
              <DimensionBar label="Education"   score={breakdown.education.score}    accent={accent} />
            </div>
          </div>
        </div>

        {/* Keywords */}
        <KeywordSection
          matched={breakdown.keywordMatch.matched}
          missing={breakdown.keywordMatch.missing}
          synonymMatched={breakdown.keywordMatch.synonymMatched}
        />

        {/* Formatting issues (when present) */}
        {breakdown.formatting.issues.length > 0 && (
          <div className="px-4 pb-3 border-t border-slate-800 pt-3 space-y-1">
            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">Formatting Issues</p>
            {breakdown.formatting.issues.map((issue, i) => (
              <p key={i} className="text-[11px] text-amber-300/80 flex items-start gap-1.5">
                <span className="text-amber-500 mt-0.5">·</span>{issue}
              </p>
            ))}
          </div>
        )}

        {/* Suggestions */}
        <SuggestionsList suggestions={activeResult.suggestions} />
      </div>

      {/* ── AI Summary ── */}
      <AISummary analysis={analysis} />
    </div>
  );
}
