'use client';

import { CheckerResult, CheckerID, CVCorrections } from './types';
import CheckerDetail from './CheckerDetail';
import {
  BarChart2, AlignLeft, TrendingUp, Clock, Zap,
  Layout, Star, RefreshCw, SpellCheck, ChevronRight,
} from 'lucide-react';

const CHECKER_META: Record<CheckerID, { icon: React.ReactNode; short: string; desc: string }> = {
  quantification: { icon: <BarChart2 size={12} />, short: 'Quantification', desc: 'Measurable impact' },
  bullet_length:  { icon: <AlignLeft size={12} />,   short: 'Bullet Length',  desc: 'Concise phrasing'  },
  bullet_improver:{ icon: <TrendingUp size={12} />,  short: 'Bullet Impact',  desc: 'Strong action language' },
  verb_tense:     { icon: <Clock size={12} />,        short: 'Verb Tense',     desc: 'Consistent tense'  },
  weak_verb:      { icon: <Zap size={12} />,          short: 'Weak Verbs',     desc: 'Impactful verbs'   },
  section_checker:{ icon: <Layout size={12} />,       short: 'Sections',       desc: 'Required sections' },
  skill_checker:  { icon: <Star size={12} />,         short: 'Skills',         desc: 'Skill coverage'    },
  repetition:     { icon: <RefreshCw size={12} />,    short: 'Repetition',     desc: 'Word variety'      },
  spelling:       { icon: <SpellCheck size={12} />,   short: 'Spelling',       desc: 'Spelling accuracy' },
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

function CheckerRow({ checker, onClick, dimmed }: {
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
      className={`group w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 text-left
        ${onClick ? 'hover:bg-slate-800/60 cursor-pointer' : 'cursor-default'}
        ${dimmed ? 'opacity-35' : ''}`}
    >
      {/* Icon */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white/60 transition-colors group-hover:text-white/80"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(79,70,229,0.12))',
          border: '1px solid rgba(124,58,237,0.18)',
        }}
      >
        {meta.icon}
      </div>

      {/* Name + progress bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-300 group-hover:text-slate-100 transition-colors leading-none">
            {meta.short}
          </span>
          {hasData && (
            allGood ? (
              <span className="text-[9px] font-bold text-emerald-400 flex-shrink-0">✓</span>
            ) : issueCount > 0 ? (
              <span
                className="text-[8px] font-black px-1.5 py-[2px] rounded-md flex-shrink-0 tabular-nums"
                style={{ color: scoreColor, background: `${scoreColor}18`, border: `1px solid ${scoreColor}30` }}
              >
                {issueCount}
              </span>
            ) : null
          )}
        </div>
        {hasData && (
          <div className="h-[3px] rounded-full mt-1.5 overflow-hidden bg-white/[0.04]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${checker.score}%`, background: scoreColor, opacity: 0.65 }}
            />
          </div>
        )}
      </div>

      {/* Chevron */}
      {onClick && (
        <ChevronRight size={11} className="text-slate-700 flex-shrink-0 group-hover:text-slate-500 transition-colors" />
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
          background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(79,70,229,0.03) 100%)',
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

      {/* Checker rows */}
      <div className="px-1 py-1.5" style={{ background: 'rgba(8,10,20,0.85)' }}>
        {checkers.map((c) => (
          <CheckerRow
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
