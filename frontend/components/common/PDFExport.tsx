'use client';

export interface PDFExportOptions {
  filename?: string;
  quality?: number;
  format?: 'a4' | 'letter';
}

export const exportToPDF = async (
  elementId: string,
  _options: PDFExportOptions = {}
): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element with id "${elementId}" not found`);

  // Clone and strip hidden classes so all tab panels appear in the export
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.hidden').forEach(el => el.classList.remove('hidden'));

  // Collect all external stylesheets so the print window renders correctly
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(l => `<link rel="stylesheet" href="${(l as HTMLLinkElement).href}">`)
    .join('\n');

  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Popup blocked — allow popups and try again');

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${styleLinks}
  <style>
    @media print {
      @page { margin: 10mm; }
      body { background: #0d1117 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body { background: #0d1117; margin: 0; padding: 24px; }
  </style>
</head>
<body>${clone.outerHTML}</body>
</html>`);

  printWindow.document.close();

  // Wait for styles to load before printing
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };
};

// Component wrapper for easy use
interface PDFExportButtonProps {
  targetId: string;
  filename?: string;
  children?: React.ReactNode;
  className?: string;
  onExportStart?: () => void;
  onExportComplete?: () => void;
  onExportError?: (error: Error) => void;
}

export function PDFExportButton({
  targetId,
  filename,
  children,
  className = '',
  onExportStart,
  onExportComplete,
  onExportError
}: PDFExportButtonProps) {
  const handleExport = async () => {
    try {
      onExportStart?.();
      await exportToPDF(targetId, { filename });
      onExportComplete?.();
    } catch (error) {
      onExportError?.(error as Error);
    }
  };

  return (
    <button onClick={handleExport} className={className}>
      {children || 'Export to PDF'}
    </button>
  );
}