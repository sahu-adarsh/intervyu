/**
 * Client-side CV text extraction.
 * PDF  → pdfjs-dist (already bundled via react-pdf)
 * DOCX → mammoth
 * TXT  → FileReader
 *
 * Returns ExtractedCV with both rawText (for backend) and structured lines
 * (for client-side checkers). Lines carry x/y/isBulletChar metadata so the
 * checker can detect indented bullets that have no explicit bullet character.
 *
 * All heavy imports are dynamic so this module is safe to import in
 * 'use client' components without breaking Next.js static export prerendering.
 */

export interface ExtractedLine {
  text: string;
  x: number;          // leftmost x of the line (px)
  y: number;          // y position (px)
  isBulletChar: boolean; // first non-space char was •-*▸◦▪►‣·
}

export interface ExtractedCV {
  rawText: string;       // joined text — sent to backend as 'extracted_text'
  lines: ExtractedLine[]; // structured lines — used by client-side checkers
}

export async function extractTextFromFile(file: File): Promise<ExtractedCV> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'txt') {
    const rawText = await file.text();
    return { rawText, lines: [] };
  }
  if (ext === 'pdf') {
    return extractFromPDF(file);
  }
  if (ext === 'docx' || ext === 'doc') {
    const rawText = await extractFromDOCX(file);
    return { rawText, lines: [] };
  }
  return { rawText: '', lines: [] };
}

async function extractFromPDF(file: File): Promise<ExtractedCV> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const allLines: ExtractedLine[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      // Collect positioned text items
      const items = content.items
        .filter((item) => 'str' in item && !!(item as { str: string }).str.trim())
        .map((item) => {
          const t = item as { str: string; transform: number[]; width: number };
          return { text: t.str, x: t.transform[4], y: t.transform[5], width: t.width };
        });

      if (items.length === 0) continue;

      // Sort top-to-bottom, left-to-right
      items.sort((a, b) =>
        Math.abs(a.y - b.y) > 3 ? b.y - a.y : a.x - b.x
      );

      // Group items on the same line (y within 3px)
      let currentGroup = [items[0]];

      for (let i = 1; i < items.length; i++) {
        const item = items[i];
        const prev = currentGroup[currentGroup.length - 1];
        if (Math.abs(item.y - prev.y) <= 3) {
          currentGroup.push(item);
        } else {
          const line = buildLine(currentGroup);
          if (line) allLines.push(line);
          currentGroup = [item];
        }
      }
      const last = buildLine(currentGroup);
      if (last) allLines.push(last);
    }

    const rawText = allLines.map((l) => l.text).join('\n');
    return { rawText, lines: allLines };
  } catch (e) {
    console.warn('[cv-extractor] PDF extraction failed:', e);
    return { rawText: '', lines: [] };
  }
}

const BULLET_CHARS = /^[•\-\*▸◦▪►‣·]/;

/**
 * Merge a group of same-y text items into a single ExtractedLine.
 * Records the leftmost x and whether the line starts with a bullet char.
 */
function buildLine(
  items: { text: string; x: number; y: number; width: number }[]
): ExtractedLine | null {
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => a.x - b.x);
  let result = sorted[0].text;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width);
    if (gap > 4) result += ' ';
    result += sorted[i].text;
  }

  const trimmed = result.trim();
  if (!trimmed) return null;

  return {
    text: trimmed,
    x: sorted[0].x,
    y: items[0].y,
    isBulletChar: BULLET_CHARS.test(trimmed),
  };
}

async function extractFromDOCX(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  } catch (e) {
    console.warn('[cv-extractor] DOCX extraction failed:', e);
    return '';
  }
}
