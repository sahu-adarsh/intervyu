'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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

type TextItems = Array<{ str: string }>;

const EMPTY_SET = new Set<number>();

const MARK_STYLE =
  'background:rgba(251,191,36,0.4);border-radius:3px;padding:0 2px;box-shadow:0 0 0 1px rgba(251,191,36,0.3);';

/**
 * Given all text items for a page and phrases to find, returns the set of item
 * indices that should be highlighted.
 *
 * Two-pass strategy:
 *  1. Join spans with spaces and do indexOf — handles the common case where PDF
 *     splits at word/token boundaries.
 *  2. Sliding-window word coverage — catches phrases split mid-span (ligatures,
 *     font changes). Requires ≥65% of significant words (>2 chars) in window.
 */
function computeHighlightedItems(items: TextItems, phrases: string[]): Set<number> {
  const highlighted = new Set<number>();
  if (!phrases.length || !items.length) return highlighted;

  // Build char-position map for each item in the joined string
  const boundaries: { start: number; end: number; idx: number }[] = [];
  let cursor = 0;
  for (let i = 0; i < items.length; i++) {
    const len = items[i].str.length;
    boundaries.push({ start: cursor, end: cursor + len, idx: i });
    cursor += len + 1; // +1 for the ' ' from .join(' ')
  }
  const pageText = items.map((x) => x.str).join(' ').toLowerCase();

  for (const phrase of phrases) {
    const norm = phrase.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!norm) continue;

    // Pass 1: exact substring (covers most PDFs where spans split at word boundaries)
    const matchStart = pageText.indexOf(norm);
    if (matchStart !== -1) {
      const matchEnd = matchStart + norm.length;
      for (const b of boundaries) {
        if (b.start < matchEnd && b.end > matchStart) highlighted.add(b.idx);
      }
      continue;
    }

    // Pass 2: sliding window — find contiguous run of items whose joined text
    // covers ≥65% of the phrase's significant words
    const words = norm.split(/\s+/).filter((w) => w.length > 2);
    if (words.length < 2) continue;

    const windowSize = Math.min(items.length, words.length * 2 + 4);
    let bestStart = -1;
    let bestEnd = -1;
    let bestScore = 0;

    for (let s = 0; s < items.length; s++) {
      const e = Math.min(s + windowSize, items.length);
      const windowText = items
        .slice(s, e)
        .map((x) => x.str)
        .join(' ')
        .toLowerCase();
      const score =
        words.filter((w) => windowText.includes(w)).length / words.length;
      if (score > bestScore) {
        bestScore = score;
        bestStart = s;
        bestEnd = e;
      }
    }

    if (bestScore >= 0.65 && bestStart !== -1) {
      for (let i = bestStart; i < bestEnd; i++) highlighted.add(i);
    }
  }

  return highlighted;
}

export default function PDFViewer({
  pdfUrl,
  highlightTexts,
  mimeType,
  rawText,
  scale = 1,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [highlightedItemsByPage, setHighlightedItemsByPage] = useState<
    Map<number, Set<number>>
  >(new Map());

  // Scroll container — used for auto-scroll to first mark
  const scrollRef = useRef<HTMLDivElement>(null);
  // Per-page text items, persisted so we can recompute when phrases change
  const pageTextsRef = useRef<Map<number, TextItems>>(new Map());
  // Ref so the stable handleTextLoaded always reads latest phrases
  const highlightTextsRef = useRef(highlightTexts);
  useEffect(() => {
    highlightTextsRef.current = highlightTexts;
  }, [highlightTexts]);

  // Recompute all already-loaded pages when the phrase list changes
  useEffect(() => {
    if (!highlightTexts.length) {
      setHighlightedItemsByPage(new Map());
      return;
    }
    const next = new Map<number, Set<number>>();
    for (const [pageIdx, items] of pageTextsRef.current) {
      next.set(pageIdx, computeHighlightedItems(items, highlightTexts));
    }
    setHighlightedItemsByPage(next);
  }, [highlightTexts]);

  // Auto-scroll to first <mark> after the text layer re-renders with highlights
  useEffect(() => {
    if (!highlightTexts.length) return;
    const timer = setTimeout(() => {
      const container = scrollRef.current;
      const mark = container?.querySelector('mark');
      if (mark && container) {
        const markTop = mark.getBoundingClientRect().top;
        const containerTop = container.getBoundingClientRect().top;
        // Place the mark at ~1/3 from the top of the visible area
        const scrollTarget =
          container.scrollTop +
          markTop -
          containerTop -
          container.clientHeight / 3;
        container.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
      }
    }, 400); // 400ms: enough for react-pdf to re-render the text layer
    return () => clearTimeout(timer);
  }, [highlightedItemsByPage, highlightTexts]);

  // Stable callback — reads latest phrases via ref to avoid re-creating on every phrase change
  const handleTextLoaded = useCallback(
    (pageIndex: number, textContent: { items: Array<unknown> }) => {
      const textItems: TextItems = (
        textContent.items as Array<Record<string, unknown>>
      )
        .filter((it) => typeof it.str === 'string')
        .map((it) => ({ str: it.str as string }));

      pageTextsRef.current.set(pageIndex, textItems);

      const phrases = highlightTextsRef.current;
      if (phrases.length) {
        setHighlightedItemsByPage((prev) => {
          const next = new Map(prev);
          next.set(pageIndex, computeHighlightedItems(textItems, phrases));
          return next;
        });
      }
    },
    [] // intentionally stable — reads highlightTexts via ref
  );

  const isPdf = !mimeType || mimeType.includes('pdf');

  // ── Null state ────────────────────────────────────────────────────────────
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

  // ── Non-PDF fallback ──────────────────────────────────────────────────────
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

  const pageWidth = Math.min(
    640,
    typeof window !== 'undefined' ? Math.floor(window.innerWidth * 0.48) : 600
  );

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto flex flex-col items-center bg-slate-950 py-5 gap-4 px-4"
    >
      {/* Skeleton shown until first page renders */}
      {!loaded && (
        <div className="w-full max-w-[640px] rounded-xl bg-slate-900 border border-slate-800 overflow-hidden animate-pulse">
          <div className="h-[800px]" />
        </div>
      )}

      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
          setLoaded(true);
        }}
        onLoadError={() => setLoadError(true)}
        loading={null}
      >
        {Array.from({ length: numPages }, (_, i) => {
          const pageIndex = i;
          const highlightedSet =
            highlightedItemsByPage.get(pageIndex) ?? EMPTY_SET;

          return (
            <div
              key={i + 1}
              className="shadow-2xl shadow-black/50 rounded-xl overflow-hidden mb-2"
            >
              <Page
                pageNumber={i + 1}
                width={pageWidth * scale}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onGetTextSuccess={(tc) => handleTextLoaded(pageIndex, tc as any)}
                customTextRenderer={({
                  str,
                  itemIndex,
                }: {
                  str: string;
                  itemIndex: number;
                }) => {
                  if (!str.trim() || !highlightedSet.size) return str;
                  return highlightedSet.has(itemIndex)
                    ? `<mark style="${MARK_STYLE}">${str}</mark>`
                    : str;
                }}
                renderTextLayer={true}
                renderAnnotationLayer={false}
              />
            </div>
          );
        })}
      </Document>
    </div>
  );
}