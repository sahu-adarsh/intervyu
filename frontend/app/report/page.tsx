'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PerformanceDashboard from '@/components/performance/PerformanceDashboard';
import { exportToPDF } from '@/components/common/PDFExport';
import { Loader2, Home, RefreshCw } from 'lucide-react';
import { getPerformanceReport } from '@/lib/api';
import { posthog } from '@/lib/posthog';

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 90_000;

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session');

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const stopPolling = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollReport = async () => {
    if (!sessionId) {
      setError('No session ID provided.');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await getPerformanceReport(sessionId);

      if (data.status === 'processing') {
        // Still generating — schedule next poll if within timeout
        if (Date.now() - startTimeRef.current < POLL_TIMEOUT_MS) {
          pollRef.current = setTimeout(pollReport, POLL_INTERVAL_MS);
        } else {
          setError('Report is taking longer than expected. Please retry in a moment.');
          setLoading(false);
        }
        return;
      }

      const reportData = data.report ?? data;
      posthog.capture('report_viewed', {
        session_id: sessionId,
        overall_score: reportData?.overall_score ?? reportData?.scores?.overall,
        verdict: reportData?.verdict ?? reportData?.recommendation,
      });
      setReport(reportData);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report.');
      setLoading(false);
    }
  };

  useEffect(() => {
    startTimeRef.current = Date.now();
    pollReport();
    return stopPolling;
  }, [sessionId]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    startTimeRef.current = Date.now();
    stopPolling();
    pollReport();
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-violet-400 mx-auto" />
          <p className="text-slate-400 font-medium">Generating your performance report…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-red-400 font-medium">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
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
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm"
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-violet-400" />
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
