'use client';

import { CheckerResult, CheckerID, CVCorrections } from './types';
import CheckerDetail from './CheckerDetail';
import {
  BarChart2, AlignLeft, TrendingUp, Clock, Zap,
  Layout, Star, RefreshCw, SpellCheck
} from 'lucide-react';

const CHECKER_META: Record<CheckerID, { icon: React.ReactNode; short: string }> = {
  quantification: { icon: <BarChart2 size={16} />, short: 'Quantification' },
  bullet_length: { icon: <AlignLeft size={16} />, short: 'Bullet Length' },
  bullet_improver: { icon: <TrendingUp size={16} />, short: 'Bullet Impact' },
  verb_tense: { icon: <Clock size={16} />, short: 'Verb Tense' },
  weak_verb: { icon: <Zap size={16} />, short: 'Weak Verbs' },
  section_checker: { icon: <Layout size={16} />, short: 'Sections' },
  skill_checker: { icon: <Star size={16} />, short: 'Skills' },
  repetition: { icon: <RefreshCw size={16} />, short: 'Repetition' },
  spelling: { icon: <SpellCheck size={16} />, short: 'Spelling' },
};

const FALLBACK_CHECKERS: CheckerResult[] = (Object.keys(CHECKER_META) as CheckerID[]).map(id => ({
  id,
  label: CHECKER_META[id].short,
  description: '',
  needsFix: [],
  good: [],
  score: 0,
}));

interface CheckerSidebarProps {
  corrections: CVCorrections | null;
  activeChecker: CheckerID | null;
  onSelect: (id: CheckerID) => void;
  onDeselect: () => void;
}

function CheckerCard({ checker, onClick, index }: { checker: CheckerResult; onClick: () => void; index: number }) {
  const issueCount = checker.needsFix.length;
  const hasData = checker.score > 0 || issueCount > 0 || checker.good.length > 0;
  const allGood = hasData && issueCount === 0;
  const meta = CHECKER_META[checker.id];

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center gap-2.5 p-3 rounded-2xl border transition-all duration-200 text-center
        border-slate-700/60 bg-slate-800/30 hover:bg-slate-800/70 hover:border-violet-500/40
        hover:shadow-lg hover:shadow-violet-500/5 hover:-translate-y-0.5"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white/90 transition-transform duration-200 group-hover:scale-110"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
      >
        {meta.icon}
      </div>

      {/* Label */}
      <span className="text-[11px] font-medium text-slate-300 leading-tight">{meta.short}</span>

      {/* Status badge */}
      {hasData ? (
        allGood ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">
            ✓ Good
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold">
            {issueCount} fix{issueCount !== 1 ? 'es' : ''}
          </span>
        )
      ) : (
        <span className="text-[10px] text-slate-700">—</span>
      )}

      {/* Bottom score bar */}
      {hasData && (
        <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full overflow-hidden bg-slate-700/50">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${checker.score}%`,
              background: allGood ? '#10b981' : checker.score > 50 ? '#f59e0b' : '#f87171',
            }}
          />
        </div>
      )}
    </button>
  );
}

export default function CheckerSidebar({ corrections, activeChecker, onSelect, onDeselect }: CheckerSidebarProps) {
  const checkers = corrections?.checkers?.length ? corrections.checkers : FALLBACK_CHECKERS;
  const active = activeChecker ? checkers.find((c) => c.id === activeChecker) : null;

  const totalIssues = checkers.reduce((sum, c) => sum + c.needsFix.length, 0);
  const hasData = corrections?.checkers?.length > 0;

  if (active) {
    return (
      <div className="flex-1 overflow-auto">
        <CheckerDetail checker={active} onBack={onDeselect} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fixes &amp; Corrections</p>
        {hasData && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
            totalIssues === 0
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          }`}>
            {totalIssues === 0 ? 'All clear' : `${totalIssues} total`}
          </span>
        )}
      </div>

      {!hasData && (
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-slate-800/40 border border-dashed border-slate-700/60">
          <p className="text-xs text-slate-500 text-center">
            Upload a new CV to generate detailed corrections
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {checkers.map((c, i) => (
          <CheckerCard key={c.id} checker={c} onClick={() => onSelect(c.id)} index={i} />
        ))}
      </div>
    </div>
  );
}
