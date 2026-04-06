'use client';

import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PDFViewerProps {
  pdfUrl: string | null;
  highlightTexts: string[];
  mimeType?: string;
  rawText?: string;
  scale?: number;
}

export default function PDFViewer({ pdfUrl, highlightTexts, mimeType, rawText, scale = 1 }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isPdf = !mimeType || mimeType.includes('pdf');

  const customTextRenderer = useCallback(
    ({ str }: { str: string }) => {
      if (!highlightTexts.length || !str.trim()) return str;

      const strLower = str.toLowerCase();
      const shouldHighlight = highlightTexts.some((phrase) => {
        const phraseLower = phrase.toLowerCase();
        if (phraseLower.includes(strLower) || strLower.includes(phraseLower.slice(0, 30))) return true;
        const words = phraseLower.split(/\s+/).filter((w) => w.length > 3);
        if (words.length >= 3) {
          const matchCount = words.filter((w) => strLower.includes(w)).length;
          return matchCount / words.length >= 0.6;
        }
        return false;
      });

      if (shouldHighlight) {
        return `<mark style="background:rgba(251,191,36,0.4);border-radius:3px;padding:0 2px;box-shadow:0 0 0 1px rgba(251,191,36,0.3);">${str}</mark>`;
      }
      return str;
    },
    [highlightTexts]
  );

  // Null state — loading pre-signed URL
  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-slate-600 border-t-violet-400 rounded-full animate-spin" />
          </div>
          <p className="text-xs text-slate-500">Loading CV preview…</p>
        </div>
      </div>
    );
  }

  // Non-PDF fallback
  if (!isPdf || loadError) {
    return (
      <div className="h-full overflow-auto p-6 bg-slate-950">
        {rawText ? (
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-5 text-slate-300 text-xs font-mono whitespace-pre-wrap leading-relaxed">
            {rawText}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-3">
              <div className="w-14 h-14 mx-auto rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                📄
              </div>
              <p className="text-sm text-slate-400 font-medium">PDF preview unavailable</p>
              <p className="text-xs text-slate-600 max-w-xs">
                The CV corrections and analysis on the right are still fully available.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const pageWidth = Math.min(640, typeof window !== 'undefined' ? Math.floor(window.innerWidth * 0.48) : 600);

  return (
    <div className="h-full overflow-auto flex flex-col items-center bg-slate-950 py-5 gap-4 px-4">
      {/* Skeleton shown until first page renders */}
      {!loaded && (
        <div className="w-full max-w-[640px] rounded-xl bg-slate-900 border border-slate-800 overflow-hidden animate-pulse">
          <div className="h-[800px]" />
        </div>
      )}

      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages }) => { setNumPages(numPages); setLoaded(true); }}
        onLoadError={() => setLoadError(true)}
        loading={null}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i + 1} className="shadow-2xl shadow-black/50 rounded-xl overflow-hidden mb-2">
            <Page
              pageNumber={i + 1}
              width={pageWidth * scale}
              customTextRenderer={customTextRenderer}
              renderTextLayer={true}
              renderAnnotationLayer={false}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}
