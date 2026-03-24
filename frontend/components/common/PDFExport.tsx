'use client';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface PDFExportOptions {
  filename?: string;
  quality?: number;
  format?: 'a4' | 'letter';
}

export const exportToPDF = async (
  elementId: string,
  options: PDFExportOptions = {}
): Promise<void> => {
  const {
    filename = 'report.pdf',
    quality = 0.95,
    format = 'a4'
  } = options;

  try {
    const element = document.getElementById(elementId);

    if (!element) {
      throw new Error(`Element with id "${elementId}" not found`);
    }

    // Show loading state
    const originalContent = element.innerHTML;
    element.style.opacity = '0.7';

    // Capture element as canvas
    const canvas = await html2canvas(element, {
      scale: 2, // Higher resolution
      logging: false,
      useCORS: true,
      allowTaint: true
    });

    // Restore original state
    element.style.opacity = '1';

    // Calculate PDF dimensions
    const imgWidth = format === 'a4' ? 210 : 216; // mm
    const pageHeight = format === 'a4' ? 297 : 279; // mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    // Create PDF
    const pdf = new jsPDF({
      orientation: imgHeight > imgWidth ? 'portrait' : 'landscape',
      unit: 'mm',
      format: format
    });

    // Add image to PDF
    const imgData = canvas.toDataURL('image/jpeg', quality);
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add new pages if content is too long
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Save PDF
    pdf.save(filename);

    return Promise.resolve();
  } catch (error) {
    throw error;
  }
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