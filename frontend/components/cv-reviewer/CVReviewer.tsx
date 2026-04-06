'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { getCVPresignedUrl } from '@/lib/api';
import { CVAnalysis, CVCorrections, CheckerID, CheckerResult } from './types';
import AtsScorePanel from './AtsScorePanel';
import CheckerSidebar from './CheckerSidebar';
import { FileText, BarChart2, ZoomIn, ZoomOut } from 'lucide-react';

const PDFViewer = dynamic(() => import('./PDFViewer'), { ssr: false });

interface CVReviewerProps {
  sessionId: string;
  analysis: CVAnalysis;
  corrections: CVCorrections | null;
  atsScore: number;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  localPdfFile?: File | null;
}

export default function CVReviewer({
  sessionId,
  analysis,
  corrections,
  atsScore,
  matchedKeywords,
  missingKeywords,
  localPdfFile,
}: CVReviewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | undefined>(undefined);
  const [activeChecker, setActiveChecker] = useState<CheckerID | null>(null);
  const [highlightTexts, setHighlightTexts] = useState<string[]>([]);
  const [pdfScale, setPdfScale] = useState(1);
  const [mobileTab, setMobileTab] = useState<'cv' | 'analysis'>('analysis');

  // Unified PDF loading: localPdfFile takes priority, else fetch presigned URL
  useEffect(() => {
    setActiveChecker(null);
    setHighlightTexts([]);
    setPdfUrl(null);
    setMimeType(undefined);

    if (localPdfFile) {
      const url = URL.createObjectURL(localPdfFile);
      setPdfUrl(url);
      setMimeType(localPdfFile.type);
      return () => URL.revokeObjectURL(url);
    }

    if (!sessionId) return;
    let cancelled = false;
    getCVPresignedUrl(sessionId)
      .then(({ url }) => { if (!cancelled) setPdfUrl(url); })
      .catch(() => { /* PDF unavailable — graceful degradation */ });
    return () => { cancelled = true; };
  }, [sessionId, localPdfFile]);

  const handleCheckerSelect = useCallback(
    (id: CheckerID) => {
      setActiveChecker(id);
      const checker: CheckerResult | undefined = corrections?.checkers?.find((c) => c.id === id);
      setHighlightTexts(checker?.needsFix.map((i) => i.text) ?? []);
      setMobileTab('cv'); // switch to PDF view to see highlights on mobile
    },
    [corrections]
  );

  const handleCheckerDeselect = useCallback(() => {
    setActiveChecker(null);
    setHighlightTexts([]);
  }, []);

  const totalIssues = corrections?.checkers?.reduce((s, c) => s + c.needsFix.length, 0) ?? 0;
  const scoreColor = atsScore >= 80 ? 'text-emerald-400' : atsScore >= 60 ? 'text-violet-400' : 'text-amber-400';
  const scoreDot = atsScore >= 80 ? 'bg-emerald-400' : atsScore >= 60 ? 'bg-violet-400' : 'bg-amber-400';

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 overflow-hidden">
      {/* ── Mobile tab bar ── */}
      <div className="sm:hidden flex border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <button
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors border-b-2 ${
            mobileTab === 'cv'
              ? 'text-violet-400 border-violet-400'
              : 'text-slate-500 border-transparent'
          }`}
          onClick={() => setMobileTab('cv')}
        >
          <FileText size={14} /> CV Preview
        </button>
        <button
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors border-b-2 ${
            mobileTab === 'analysis'
              ? 'text-violet-400 border-violet-400'
              : 'text-slate-500 border-transparent'
          }`}
          onClick={() => setMobileTab('analysis')}
        >
          <BarChart2 size={14} /> Analysis
        </button>
      </div>

      {/* ── Main body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: PDF Panel */}
        <div className={`${mobileTab === 'cv' ? 'flex' : 'hidden'} sm:flex flex-col w-full sm:w-[52%] border-r border-slate-800 bg-slate-950 overflow-hidden`}>
          {/* PDF toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/50 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <FileText size={12} className="text-slate-500" />
              <span className="text-[10px] text-slate-500">
                {activeChecker ? (
                  <span className="text-amber-400">Highlighting: {activeChecker.replace(/_/g, ' ')}</span>
                ) : (
                  'Click a checker to highlight issues'
                )}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPdfScale(s => Math.max(0.6, s - 0.1))}
                className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
              ><ZoomOut size={12} /></button>
              <span className="text-[10px] text-slate-600 w-8 text-center">{Math.round(pdfScale * 100)}%</span>
              <button
                onClick={() => setPdfScale(s => Math.min(1.5, s + 0.1))}
                className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
              ><ZoomIn size={12} /></button>
            </div>
          </div>
          <PDFViewer
            pdfUrl={pdfUrl}
            highlightTexts={highlightTexts}
            mimeType={mimeType ?? analysis.file_type}
            scale={pdfScale}
          />
        </div>

        {/* Right: Analysis Panel */}
        <div className={`${mobileTab === 'analysis' ? 'flex' : 'hidden'} sm:flex flex-col w-full sm:w-[48%] bg-slate-900/30 overflow-hidden`}>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <AtsScorePanel
              atsScore={atsScore}
              analysis={analysis}
              matchedKeywords={matchedKeywords}
              missingKeywords={missingKeywords}
            />
            <CheckerSidebar
              corrections={corrections}
              activeChecker={activeChecker}
              onSelect={handleCheckerSelect}
              onDeselect={handleCheckerDeselect}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
