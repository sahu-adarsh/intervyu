'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PDFThumbnailProps {
  url: string;
  width?: number;
}

export default function PDFThumbnail({ url, width = 220 }: PDFThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) return null;

  return (
    <div className="relative overflow-hidden" style={{ width, height: Math.round(width * 1.41) }}>
      {!loaded && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse rounded" />
      )}
      <Document
        file={url}
        onLoadSuccess={() => setLoaded(true)}
        onLoadError={() => setError(true)}
        loading={null}
      >
        <Page
          pageNumber={1}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
    </div>
  );
}
