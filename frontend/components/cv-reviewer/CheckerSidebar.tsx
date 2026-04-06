'use client';

import { CheckerResult, CheckerID, CVCorrections } from './types';
import CheckerDetail from './CheckerDetail';
import {
  BarChart2, AlignLeft, TrendingUp, Clock, Zap,
  Layout, Star, RefreshCw, SpellCheck
} from 'lucide-react';

const CHECKER_ICONS: Record<CheckerID, React.ReactNode> = {
  quantification: <BarChart2 size={18} />,
  bullet_length: <AlignLeft size={18} />,
  bullet_improver: <TrendingUp size={18} />,
  verb_tense: <Clock size={18} />,
  weak_verb: <Zap size={18} />,
  section_checker: <Layout size={18} />,
  skill_checker: <Star size={18} />,
  repetition: <RefreshCw size={18} />,
  spelling: <SpellCheck size={18} />,
};

const FALLBACK_CHECKERS: CheckerResult[] = [
  { id: 'quantification', label: 'Quantification Checker', description: 'Bullet points missing metrics/numbers', needsFix: [], good: [], score: 0 },
  { id: 'bullet_length', label: 'Bullet Point Length', description: 'Bullets too long or too short', needsFix: [], good: [], score: 0 },
  { id: 'bullet_improver', label: 'Bullet Points Improver', description: 'Weak or generic bullet points', needsFix: [], good: [], score: 0 },
  { id: 'verb_tense', label: 'Verb Tense Checker', description: 'Wrong tense for past/current jobs', needsFix: [], good: [], score: 0 },
  { id: 'weak_verb', label: 'Weak Verb Checker', description: "Starts with 'Worked on', 'Helped', etc.", needsFix: [], good: [], score: 0 },
  { id: 'section_checker', label: 'Section Checker', description: 'Missing resume sections', needsFix: [], good: [], score: 0 },
  { id: 'skill_checker', label: 'Skill Checker', description: 'Missing important skills', needsFix: [], good: [], score: 0 },
  { id: 'repetition', label: 'Repetition Checker', description: 'Repeated words or phrases', needsFix: [], good: [], score: 0 },
  { id: 'spelling', label: 'Spelling Checker', description: 'Spelling errors and typos', needsFix: [], good: [], score: 0 },
];

interface CheckerSidebarProps {
  corrections: CVCorrections | null;
  activeChecker: CheckerID | null;
  onSelect: (id: CheckerID) => void;
  onDeselect: () => void;
}

function CheckerCard({ checker, onClick }: { checker: CheckerResult; onClick: () => void }) {
  const issueCount = checker.needsFix.length;
  const hasData = checker.score > 0 || issueCount > 0 || checker.good.length > 0;
  const allGood = hasData && issueCount === 0;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-700/60 bg-slate-800/40 hover:bg-slate-700/50 hover:border-violet-500/50 transition-all text-center group"
    >
      <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center text-violet-400 group-hover:bg-violet-600/30 transition-colors">
        {CHECKER_ICONS[checker.id]}
      </div>
      <span className="text-xs font-medium text-slate-300 leading-tight">{checker.label}</span>
      {hasData ? (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
          allGood
            ? 'bg-emerald-900/40 text-emerald-300'
            : 'bg-amber-900/40 text-amber-300'
        }`}>
          {allGood ? 'All good' : `${issueCount} issue${issueCount !== 1 ? 's' : ''}`}
        </span>
      ) : (
        <span className="text-[10px] text-slate-600">—</span>
      )}
    </button>
  );
}

export default function CheckerSidebar({ corrections, activeChecker, onSelect, onDeselect }: CheckerSidebarProps) {
  const checkers = corrections?.checkers?.length ? corrections.checkers : FALLBACK_CHECKERS;
  const active = activeChecker ? checkers.find((c) => c.id === activeChecker) : null;

  if (active) {
    return (
      <div className="flex-1 overflow-auto">
        <CheckerDetail checker={active} onBack={onDeselect} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Fixes &amp; Corrections
      </p>
      {!corrections?.checkers?.length && (
        <p className="text-xs text-slate-500 mb-3 italic">
          Analysis not yet available — upload a new CV to generate corrections.
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {checkers.map((c) => (
          <CheckerCard key={c.id} checker={c} onClick={() => onSelect(c.id)} />
        ))}
      </div>
    </div>
  );
}
