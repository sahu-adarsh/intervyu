'use client';

import { useState } from 'react';
import { CheckerResult, CorrectionItem } from './types';
import { ChevronDown, ChevronRight, ArrowLeft, Lightbulb } from 'lucide-react';

interface CheckerDetailProps {
  checker: CheckerResult;
  onBack: () => void;
}

function CorrectionCard({ item, variant }: { item: CorrectionItem; variant: 'fix' | 'good' }) {
  const [expanded, setExpanded] = useState(false);
  const isFix = variant === 'fix';

  return (
    <div
      className={`rounded-lg border text-sm cursor-pointer transition-colors ${
        isFix
          ? 'border-rose-800/50 bg-rose-900/10 hover:bg-rose-900/20'
          : 'border-emerald-800/50 bg-emerald-900/10 hover:bg-emerald-900/20'
      }`}
      onClick={() => setExpanded((p) => !p)}
    >
      <div className="flex items-start gap-2 p-3">
        <span className={`mt-0.5 shrink-0 ${isFix ? 'text-rose-400' : 'text-emerald-400'}`}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <p className={`leading-snug flex-1 ${isFix ? 'text-rose-200' : 'text-emerald-200'}`}>
          {item.text}
        </p>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/50 pt-2 ml-5">
          {item.issue && (
            <p className="text-xs text-slate-400">{item.issue}</p>
          )}
          {item.suggestion && (
            <div className="flex items-start gap-1.5 text-xs text-violet-300">
              <Lightbulb size={12} className="mt-0.5 shrink-0" />
              <span>{item.suggestion}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CheckerDetail({ checker, onBack }: CheckerDetailProps) {
  const [showGood, setShowGood] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-slate-200 transition-colors p-1 -ml-1"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{checker.label}</h3>
          <p className="text-xs text-slate-500">{checker.description}</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-4 pr-1">
        {/* Needs Fix section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
              Needs Fix
            </p>
            <span className="text-xs bg-rose-900/40 text-rose-300 px-2 py-0.5 rounded-full">
              {checker.needsFix.length}
            </span>
          </div>
          {checker.needsFix.length === 0 ? (
            <p className="text-xs text-slate-500 italic">None found — great job!</p>
          ) : (
            <div className="space-y-2">
              {checker.needsFix.map((item, i) => (
                <CorrectionCard key={i} item={item} variant="fix" />
              ))}
            </div>
          )}
        </div>

        {/* Good section */}
        {checker.good.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 hover:text-emerald-300 transition-colors"
              onClick={() => setShowGood((p) => !p)}
            >
              {showGood ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Good ({checker.good.length})
            </button>
            {showGood && (
              <div className="space-y-2">
                {checker.good.map((item, i) => (
                  <CorrectionCard key={i} item={item} variant="good" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
