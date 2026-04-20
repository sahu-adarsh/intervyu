'use client';

import { CheckerResult, CheckerID, CVCorrections } from './types';
import CheckerDetail from './CheckerDetail';
import {
  BarChart2, AlignLeft, TrendingUp, Clock, Zap,
  Layout, Star, RefreshCw, SpellCheck,
} from 'lucide-react';

const CHECKER_META: Record<CheckerID, { icon: React.ReactNode; short: string; ai: boolean }> = {
  quantification: { icon: <BarChart2 size={14} />, short: 'Quantification', ai: true  },
  bullet_length:  { icon: <AlignLeft size={14} />,  short: 'Bullet Length',  ai: false },
  bullet_improver:{ icon: <TrendingUp size={14} />, short: 'Bullet Impact',  ai: true  },
  verb_tense:     { icon: <Clock size={14} />,       short: 'Verb Tense',    ai: false },
  weak_verb:      { icon: <Zap size={14} />,         short: 'Weak Verbs',    ai: false },
  section_checker:{ icon: <Layout size={14} />,      short: 'Sections',      ai: true  },
  skill_checker:  { icon: <Star size={14} />,        short: 'Skills',        ai: true  },
  repetition:     { icon: <RefreshCw size={14} />,   short: 'Repetition',    ai: false },
  spelling:       { icon: <SpellCheck size={14} />,  short: 'Spelling',      ai: false },
};

const CHECKER_IDS = Object.keys(CHECKER_META) as CheckerID[];

interface CheckerSidebarProps {
  corrections: CVCorrections | null;
  activeChecker: CheckerID | null;
  onSelect: (id: CheckerID) => void;
  onDeselect: () => void;
  onItemHighlight?: (text: string) => void;
  aiPending?: boolean;
}

function CheckerBox({ id, checker, onClick, dimmed, pending, aiDone }: {
  id: CheckerID;
  checker: CheckerResult | null;
  onClick?: () => void;
  dimmed?: boolean;
  pending?: boolean;
  aiDone?: boolean;
}) {
  const meta = CHECKER_META[id];
  const issueCount = checker?.needsFix.length ?? 0;
  const hasData = checker != null && (checker.score > 0 || issueCount > 0 || checker.good.length > 0);
  const allGood = hasData && issueCount === 0;
  const scoreColor = allGood ? '#10b981' : (checker?.score ?? 0) > 50 ? '#f59e0b' : '#f87171';

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`group relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-150 text-center
        ${onClick ? 'hover:bg-slate-700/40 cursor-pointer' : 'cursor-default'}
        ${dimmed ? 'opacity-35' : ''}
        ${pending ? 'opacity-50' : ''}`}
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
      {pending ? (
        <span className="flex items-center gap-1 text-[9px] font-semibold text-slate-600 bg-slate-800/60 border border-slate-700/40 px-1.5 py-0.5 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full border border-slate-600 border-t-slate-400 animate-spin inline-block" />
          AI
        </span>
      ) : hasData ? (
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
      ) : aiDone && meta.ai ? (
        <span className="text-[9px] text-slate-700 bg-slate-800/40 border border-slate-700/30 px-1.5 py-0.5 rounded-md">
          N/A
        </span>
      ) : null}

      {/* Score bar at bottom */}
      {hasData && (
        <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full overflow-hidden bg-white/[0.04]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${checker?.score ?? 0}%`, background: scoreColor, opacity: 0.6 }}
          />
        </div>
      )}
    </button>
  );
}

export default function CheckerSidebar({ corrections, activeChecker, onSelect, onDeselect, onItemHighlight, aiPending = false }: CheckerSidebarProps) {
  // corrections === null  → everything still loading (just uploaded)
  // corrections !== null  → at least client checkers are done; AI ones may be missing
  const isLoading = corrections === null;
  const byId = new Map(corrections?.checkers?.map(c => [c.id, c]) ?? []);

  const active = activeChecker ? byId.get(activeChecker) ?? null : null;

  const totalIssues = corrections?.checkers?.reduce((sum, c) => sum + c.needsFix.length, 0) ?? 0;
  const hasAnyData = (corrections?.checkers?.length ?? 0) > 0;

  if (active) {
    return (
      <div className="flex-1 overflow-auto">
        <CheckerDetail checker={active} onBack={onDeselect} onHighlight={onItemHighlight} />
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
        ) : hasAnyData ? (
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

      {/* Checker boxes grid — always all 9 */}
      <div
        className="grid grid-cols-3 gap-2 p-3"
        style={{ background: 'rgba(8,10,20,0.85)' }}
      >
        {CHECKER_IDS.map((id) => {
          const checker = byId.get(id) ?? null;
          const meta = CHECKER_META[id];
          // Only show AI spinner while we're actively polling; once done, show N/A
          const isPending = !isLoading && checker === null && meta.ai && aiPending;
          return (
            <CheckerBox
              key={id}
              id={id}
              checker={checker}
              onClick={checker != null ? () => onSelect(id) : undefined}
              dimmed={isLoading}
              pending={isPending}
              aiDone={!aiPending}
            />
          );
        })}
      </div>
    </div>
  );
}
