'use client';

import { useState } from 'react';
import { CheckerResult, CorrectionItem } from './types';
import { ChevronRight, ArrowLeft, Lightbulb, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';

interface CheckerDetailProps {
  checker: CheckerResult;
  onBack: () => void;
  onHighlight?: (text: string) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-700/40 text-emerald-400"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CorrectionCard({ item, variant, onHighlight }: {
  item: CorrectionItem;
  variant: 'fix' | 'good';
  onHighlight?: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isFix = variant === 'fix';

  return (
    <button
      className={`w-full text-left rounded-xl border transition-all duration-150 ${
        isFix
          ? 'border-rose-800/40 bg-rose-950/20 hover:bg-rose-950/30'
          : 'border-emerald-800/40 bg-emerald-950/20 hover:bg-emerald-950/30'
      }`}
      onClick={() => { setExpanded((p) => !p); onHighlight?.(item.text); }}
    >
      <div className="flex items-start gap-2.5 p-3">
        <div className={`mt-0.5 shrink-0 ${isFix ? 'text-rose-400' : 'text-emerald-400'}`}>
          {isFix
            ? <AlertCircle size={13} />
            : <CheckCircle2 size={13} />}
        </div>
        <p className={`text-xs leading-relaxed flex-1 text-left ${isFix ? 'text-rose-200/90' : 'text-emerald-200/90'}`}>
          {item.text}
        </p>
        <div className={`mt-0.5 shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''} ${isFix ? 'text-rose-600' : 'text-emerald-600'}`}>
          <ChevronRight size={12} />
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2.5">
          {item.issue && (
            <p className="text-xs text-slate-400 leading-relaxed">{item.issue}</p>
          )}
          {item.suggestion && (
            <div className="flex items-start gap-1.5 rounded-lg bg-violet-950/30 border border-violet-800/30 px-2.5 py-2">
              <Lightbulb size={11} className="text-violet-400 mt-0.5 shrink-0" />
              <p className="text-xs text-violet-300 leading-relaxed">{item.suggestion}</p>
            </div>
          )}
          {item.rewrite && (
            <div className="rounded-lg bg-emerald-950/30 border border-emerald-800/40 px-2.5 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
                  Suggested rewrite
                </span>
                <CopyButton text={item.rewrite} />
              </div>
              <p className="text-xs text-emerald-200/90 leading-relaxed">{item.rewrite}</p>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

export default function CheckerDetail({ checker, onBack, onHighlight }: CheckerDetailProps) {
  const [showGood, setShowGood] = useState(false);
  const allGood = checker.needsFix.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors -ml-1"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-100 truncate">{checker.label}</h3>
          <p className="text-xs text-slate-500 truncate">{checker.description}</p>
        </div>
        {/* Score pill */}
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${
          allGood
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
        }`}>
          {allGood ? '✓ All good' : `${checker.needsFix.length} issue${checker.needsFix.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="flex-1 overflow-auto space-y-4 pr-0.5">
        {/* Needs Fix */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Needs Fix</p>
            <span className="text-xs text-slate-600 ml-auto">{checker.needsFix.length}</span>
          </div>
          {checker.needsFix.length === 0 ? (
            <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/10 px-4 py-3 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <p className="text-xs text-emerald-400">Nothing to fix here — great work!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {checker.needsFix.map((item, i) => (
                <CorrectionCard key={i} item={item} variant="fix" onHighlight={onHighlight} />
              ))}
            </div>
          )}
        </div>

        {/* Good */}
        {checker.good.length > 0 && (
          <div>
            <button
              className="flex items-center gap-2 mb-2.5 w-full hover:opacity-80 transition-opacity"
              onClick={() => setShowGood((p) => !p)}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Good</p>
              <span className="text-xs text-slate-600 ml-auto">{checker.good.length}</span>
              <div className={`text-slate-600 transition-transform ${showGood ? 'rotate-90' : ''}`}>
                <ChevronRight size={12} />
              </div>
            </button>
            {showGood && (
              <div className="space-y-2">
                {checker.good.map((item, i) => (
                  <CorrectionCard key={i} item={item} variant="good" onHighlight={onHighlight} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
