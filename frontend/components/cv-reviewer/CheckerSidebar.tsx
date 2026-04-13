'use client';

import { CheckerResult, CheckerID, CVCorrections } from './types';
import CheckerDetail from './CheckerDetail';
import {
  BarChart2, AlignLeft, TrendingUp, Clock, Zap,
  Layout, Star, RefreshCw, SpellCheck,
} from 'lucide-react';

const CHECKER_META: Record<CheckerID, { icon: React.ReactNode; short: string }> = {
  quantification: { icon: <BarChart2 size={14} />, short: 'Quantification' },
  bullet_length:  { icon: <AlignLeft size={14} />,   short: 'Bullet Length'  },
  bullet_improver:{ icon: <TrendingUp size={14} />,  short: 'Bullet Impact'  },
  verb_tense:     { icon: <Clock size={14} />,        short: 'Verb Tense'     },
  weak_verb:      { icon: <Zap size={14} />,          short: 'Weak Verbs'     },
  section_checker:{ icon: <Layout size={14} />,       short: 'Sections'       },
  skill_checker:  { icon: <Star size={14} />,         short: 'Skills'         },
  repetition:     { icon: <RefreshCw size={14} />,    short: 'Repetition'     },
  spelling:       { icon: <SpellCheck size={14} />,   short: 'Spelling'       },
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

function CheckerBox({ checker, onClick, dimmed }: {
  checker: CheckerResult;
  onClick?: () => void;
  dimmed?: boolean;
}) {
  const issueCount = checker.needsFix.length;
  const hasData = checker.score > 0 || issueCount > 0 || checker.good.length > 0;
  const allGood = hasData && issueCount === 0;
  const meta = CHECKER_META[checker.id];
  const scoreColor = allGood ? '#10b981' : checker.score > 50 ? '#f59e0b' : '#f87171';

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`group relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-150 text-center
        ${onClick ? 'hover:bg-slate-700/40 cursor-pointer' : 'cursor-default'}
        ${dimmed ? 'opacity-35' : ''}`}
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 transition-all duration-150 group-hover:text-white/80"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.20), rgba(79,70,229,0.14))',
          border: '1px solid rgba(124,58,237,0.18)',
        }}
      >
        {meta.icon}
      </div>

      {/* Label */}
      <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-200 transition-colors leading-tight">
        {meta.short}
      </span>

      {/* Status badge */}
      {hasData && (
        allGood ? (
          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
            ✓ Good
          </span>
        ) : (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ color: scoreColor, background: `${scoreColor}14`, border: `1px solid ${scoreColor}28` }}
          >
            {issueCount} fix{issueCount !== 1 ? 'es' : ''}
          </span>
        )
      )}

      {/* Score bar at bottom */}
      {hasData && (
        <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full overflow-hidden bg-white/[0.04]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${checker.score}%`, background: scoreColor, opacity: 0.6 }}
          />
        </div>
      )}
    </button>
  );
}

export default function CheckerSidebar({ corrections, activeChecker, onSelect, onDeselect }: CheckerSidebarProps) {
  const isLoading = corrections === null;
  const checkers = corrections?.checkers?.length ? corrections.checkers : FALLBACK_CHECKERS;
  const active = activeChecker ? checkers.find((c) => c.id === activeChecker) : null;

  const totalIssues = checkers.reduce((sum, c) => sum + c.needsFix.length, 0);
  const hasData = (corrections?.checkers?.length ?? 0) > 0;

  if (active) {
    return (
      <div className="flex-1 overflow-auto">
        <CheckerDetail checker={active} onBack={onDeselect} />
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Section header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.07) 0%, rgba(79,70,229,0.03) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-violet-500/15 flex items-center justify-center">
            <Layout size={10} className="text-violet-400" />
          </div>
          <span className="text-[10px] font-bold text-violet-400/70 uppercase tracking-widest">
            Fixes &amp; Corrections
          </span>
        </div>
        {isLoading ? (
          <span className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <span className="w-2.5 h-2.5 border border-slate-700 border-t-violet-500 rounded-full animate-spin" />
            Analysing...
          </span>
        ) : hasData ? (
          <span
            className={`text-[9px] font-bold px-2 py-[3px] rounded-md ${
              totalIssues === 0
                ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
            }`}
          >
            {totalIssues === 0 ? 'All clear' : `${totalIssues} total`}
          </span>
        ) : null}
      </div>

      {/* Checker boxes grid */}
      <div
        className="grid grid-cols-3 gap-2 p-3"
        style={{ background: 'rgba(8,10,20,0.85)' }}
      >
        {checkers.map((c) => (
          <CheckerBox
            key={c.id}
            checker={c}
            onClick={isLoading ? undefined : () => onSelect(c.id)}
            dimmed={isLoading}
          />
        ))}
      </div>
    </div>
  );
}
