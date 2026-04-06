'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { getCVPresignedUrl } from '@/lib/api';
import { CVAnalysis, CVCorrections, CheckerID, CheckerResult } from './types';
import AtsScorePanel from './AtsScorePanel';
import CheckerSidebar from './CheckerSidebar';
import { FileText, BarChart2 } from 'lucide-react';

const PDFViewer = dynamic(() => import('./PDFViewer'), { ssr: false });

interface CVReviewerProps {
  sessionId: string;
  analysis: CVAnalysis;
  corrections: CVCorrections | null;
  atsScore: number;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  /** If provided (fresh upload), used directly instead of fetching from backend */
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
  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'cv' | 'analysis'>('analysis');

  // If a local File was passed (fresh upload), create an object URL
  useEffect(() => {
    if (localPdfFile) {
      const url = URL.createObjectURL(localPdfFile);
      setPdfUrl(url);
      setMimeType(localPdfFile.type);
      return () => URL.revokeObjectURL(url);
    }
  }, [localPdfFile]);

  // Otherwise fetch a pre-signed URL from the backend
  useEffect(() => {
    if (localPdfFile || !sessionId) return;
    getCVPresignedUrl(sessionId)
      .then(({ url }) => setPdfUrl(url))
      .catch(() => {/* PDF unavailable for old entries — graceful degradation */});
  }, [sessionId, localPdfFile]);

  const handleCheckerSelect = useCallback(
    (id: CheckerID) => {
      setActiveChecker(id);
      const checker: CheckerResult | undefined = corrections?.checkers?.find((c) => c.id === id);
      setHighlightTexts(checker?.needsFix.map((i) => i.text) ?? []);
    },
    [corrections]
  );

  const handleCheckerDeselect = useCallback(() => {
    setActiveChecker(null);
    setHighlightTexts([]);
  }, []);

  return (
    <div className="flex h-full w-full bg-slate-900 overflow-hidden">
      {/* ── Mobile tab bar ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-10 flex border-t border-slate-700 bg-slate-900">
        <button
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs transition-colors ${mobileTab === 'cv' ? 'text-violet-400' : 'text-slate-500'}`}
          onClick={() => setMobileTab('cv')}
        >
          <FileText size={16} />
          <span>CV</span>
        </button>
        <button
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs transition-colors ${mobileTab === 'analysis' ? 'text-violet-400' : 'text-slate-500'}`}
          onClick={() => setMobileTab('analysis')}
        >
          <BarChart2 size={16} />
          <span>Analysis</span>
        </button>
      </div>

      {/* ── Left: PDF Viewer ── */}
      <div className={`${mobileTab === 'cv' ? 'flex' : 'hidden'} sm:flex flex-col w-full sm:w-[55%] border-r border-slate-700/50 overflow-hidden`}>
        <PDFViewer
          pdfUrl={pdfUrl}
          highlightTexts={highlightTexts}
          mimeType={mimeType ?? analysis.file_type}
          rawText={undefined}
        />
      </div>

      {/* ── Right: Analysis Panel ── */}
      <div className={`${mobileTab === 'analysis' ? 'flex' : 'hidden'} sm:flex flex-col w-full sm:w-[45%] overflow-hidden`}>
        <div className="flex-1 overflow-auto p-4 space-y-4 pb-16 sm:pb-4">
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
  );
}
