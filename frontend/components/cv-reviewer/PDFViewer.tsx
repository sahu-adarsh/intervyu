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
}

export default function PDFViewer({ pdfUrl, highlightTexts, mimeType, rawText }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [loadError, setLoadError] = useState(false);

  const isPdf = !mimeType || mimeType === 'application/pdf' || mimeType === 'pdf';

  const customTextRenderer = useCallback(
    ({ str }: { str: string }) => {
      if (!highlightTexts.length || !str.trim()) return str;

      const strLower = str.toLowerCase();
      const shouldHighlight = highlightTexts.some((phrase) => {
        const phraseLower = phrase.toLowerCase();
        // Direct substring match
        if (phraseLower.includes(strLower) || strLower.includes(phraseLower.slice(0, 30))) {
          return true;
        }
        // Word-overlap match for longer phrases (>=60% words match)
        const phraseWords = phraseLower.split(/\s+/).filter((w) => w.length > 3);
        if (phraseWords.length >= 3) {
          const matchCount = phraseWords.filter((w) => strLower.includes(w)).length;
          return matchCount / phraseWords.length >= 0.6;
        }
        return false;
      });

      if (shouldHighlight) {
        return `<mark style="background:rgba(251,191,36,0.45);border-radius:2px;padding:0 1px;">${str}</mark>`;
      }
      return str;
    },
    [highlightTexts]
  );

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        <div className="text-center space-y-2">
          <div className="text-4xl">📄</div>
          <p>Loading CV...</p>
        </div>
      </div>
    );
  }

  if (!isPdf || loadError) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="bg-slate-800 rounded-lg p-4 text-slate-300 text-xs font-mono whitespace-pre-wrap leading-relaxed">
          {rawText || 'CV text not available for preview.'}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto flex flex-col items-center bg-slate-900 py-4 gap-4">
      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        onLoadError={() => setLoadError(true)}
        loading={
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
            Loading PDF...
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i + 1}
            pageNumber={i + 1}
            width={Math.min(700, typeof window !== 'undefined' ? window.innerWidth * 0.5 : 700)}
            customTextRenderer={customTextRenderer}
            renderTextLayer={true}
            renderAnnotationLayer={false}
            className="shadow-xl mb-2"
          />
        ))}
      </Document>
    </div>
  );
}
