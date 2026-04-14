/**
 * Client-side CV text extraction.
 * PDF  → pdfjs-dist (already bundled via react-pdf)
 * DOCX → mammoth
 * TXT  → FileReader
 *
 * Returns the extracted text, or '' on failure (backend then falls back to
 * pdfplumber / Textract as before).
 *
 * All heavy imports are dynamic so this module is safe to import in
 * 'use client' components without breaking Next.js static export prerendering.
 */

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'txt') {
    return file.text();
  }
  if (ext === 'pdf') {
    return extractFromPDF(file);
  }
  if (ext === 'docx' || ext === 'doc') {
    return extractFromDOCX(file);
  }
  return '';
}

async function extractFromPDF(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const allLines: string[] = [];

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
      let currentLine = [items[0]];
      const pageLines: string[] = [];

      for (let i = 1; i < items.length; i++) {
        const item = items[i];
        const prev = currentLine[currentLine.length - 1];
        if (Math.abs(item.y - prev.y) <= 3) {
          currentLine.push(item);
        } else {
          pageLines.push(mergeLine(currentLine));
          currentLine = [item];
        }
      }
      pageLines.push(mergeLine(currentLine));

      allLines.push(...pageLines.filter((l) => l.trim()));
    }

    return allLines.join('\n');
  } catch (e) {
    console.warn('[cv-extractor] PDF extraction failed:', e);
    return '';
  }
}

// Merges text items on the same y-line, inserting a space at significant gaps
function mergeLine(items: { text: string; x: number; width: number }[]): string {
  if (items.length === 0) return '';
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let result = sorted[0].text;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width);
    if (gap > 4) result += ' ';
    result += sorted[i].text;
  }
  return result;
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
