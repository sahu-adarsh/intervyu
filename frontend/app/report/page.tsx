'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PerformanceDashboard from '@/components/performance/PerformanceDashboard';
import { exportToPDF } from '@/components/common/PDFExport';
import { Loader2, Home, RefreshCw } from 'lucide-react';

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session');

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const fetchReport = async () => {
    if (!sessionId) {
      setError('No session ID provided.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/interviews/${sessionId}/performance-report`
      );
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'Report not ready yet.' : 'Failed to load report.');
      }
      setReport(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchReport();
  }, [sessionId]);

  const handleRetry = () => {
    setLoading(true);
    hasFetched.current = false;
    fetchReport();
  };

  const handleExportPDF = async () => {
    await exportToPDF('performance-report-content', {
      filename: `interview-report-${sessionId}.pdf`,
      quality: 0.95,
      format: 'a4',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600 font-medium">Generating your performance report…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-red-600 font-medium">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </button>

        <div id="performance-report-content">
          <PerformanceDashboard report={report} onExportPDF={handleExportPDF} />
        </div>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
