'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  FileText, Upload, X, Sparkles, AlertCircle, CheckCircle2,
  Target, Zap, ArrowLeft, ExternalLink, Trash2,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { createSession, uploadCV, getCVPresignedUrl, getUserResumes, saveCVMetadata, getCVCorrections, deleteCV } from '@/lib/api';
import { extractTextFromFile } from '@/lib/cv-extractor';
import type { CVCorrections, CheckerResult, StructuredSuggestion } from '@/components/cv-reviewer/types';
import { runClientCheckers, mergeCorrections } from '@/lib/cv-checkers';
import { scoreResume, buildScoringInput } from '@/lib/ats-engine';
import type { ScoreResult } from '@/lib/ats-engine';

const CVReviewer = dynamic(() => import('@/components/cv-reviewer/CVReviewer'), { ssr: false });
const PDFThumbnail = dynamic(() => import('@/components/cv-reviewer/PDFThumbnail'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface CVAnalysis {
  candidateName?: string;
  email?: string;
  phone?: string;
  skills?: string[];
  technologies?: string[];
  experience?: Array<{ duration: string; company?: string; role?: string; context: string }>;
  education?: Array<{ degree: string; institution?: string; year?: string; context: string }>;
  totalYearsExperience?: number;
  industry?: string;
  summary?: string;
  file_type?: string;
}

interface StoredResume {
  id: string;
  sessionId?: string;
  filename: string;
  uploadedAt: string;
  analysis: CVAnalysis;
  corrections?: CVCorrections;
  rawText?: string;
  jobTitle?: string;
  jobDescription?: string;
  atsScore?: number;
  matchedKeywords?: string[];
  missingKeywords?: string[];
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Computes 6-platform ATS results using the real ATS engine.
// Returns results for the panel + a single avg score and Workday keywords for DB storage.
function computeAtsResults(analysis: CVAnalysis, jobDescription?: string): {
  results: ScoreResult[];
  atsScore: number;
  matched: string[];
  missing: string[];
} {
  const results = scoreResume(buildScoringInput(analysis, jobDescription));
  const atsScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length)
    : 0;
  // Use Workday (strictest, most common) for matched/missing stored to DB
  const workday = results.find((r) => r.system === 'Workday') ?? results[0];
  const matched = workday?.breakdown.keywordMatch.matched ?? [];
  const missing = workday?.breakdown.keywordMatch.missing ?? [];
  return { results, atsScore, matched, missing };
}

// ─── Resume Card (for grid view) ─────────────────────────────────────────────

function ResumeCard({ resume, onView, onDelete }: { resume: StoredResume; onView: () => void; onDelete: () => void }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const score = resume.atsScore ?? 0;
  const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#8b5cf6' : '#f59e0b';
  const scoreBg = score >= 80 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : score >= 60 ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
    : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

  useEffect(() => {
    if (!resume.sessionId) return;
    getCVPresignedUrl(resume.sessionId)
      .then(({ url }) => setPdfUrl(url))
      .catch(() => {});
  }, [resume.sessionId]);

  return (
    <div className="group bg-slate-800/50 rounded-2xl overflow-hidden hover:bg-slate-800/80 transition-all duration-300 border border-slate-700/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 flex flex-col">
      {/* Card header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-200 truncate" title={resume.filename}>
            {resume.filename}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <span>📅</span> {formatDate(resume.uploadedAt)}
            {resume.jobTitle && <span className="text-slate-600 mx-1">·</span>}
            {resume.jobTitle && <span className="truncate max-w-[120px]">{resume.jobTitle}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${scoreBg}`}>
            {score}%
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Remove"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* PDF Thumbnail — fixed height so all cards are uniform */}
      <div className="mx-4 mb-3 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/40 flex items-start justify-center"
        style={{ height: 280 }}>
        {pdfUrl ? (
          <PDFThumbnail url={pdfUrl} width={260} />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${scoreColor}22, ${scoreColor}11)` }}>
              <FileText size={18} style={{ color: scoreColor }} />
            </div>
            <p className="text-xs text-slate-500">
              {resume.sessionId ? 'Loading preview...' : 'No preview available'}
            </p>
          </div>
        )}
      </div>

      {/* View Analysis button */}
      <div className="px-4 pb-4 mt-auto">
        <button
          onClick={onView}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-150 hover:opacity-90 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
        >
          <ExternalLink size={14} />
          View Analysis
        </button>
      </div>
    </div>
  );
}

// ─── Past Resumes Grid ────────────────────────────────────────────────────────

function PastResumesGrid({ resumes, onView, onNew, onDelete }: {
  resumes: StoredResume[];
  onView: (r: StoredResume) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-auto bg-slate-950">
      <div className="px-6 py-6">
        {resumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
              <FileText size={24} className="text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">No resumes analysed yet</p>
            <button
              onClick={onNew}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
            >
              <Sparkles size={14} />
              Analyse Your First CV
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
            {resumes.map((r) => (
              <ResumeCard key={r.id} resume={r} onView={() => onView(r)} onDelete={() => onDelete(r.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upload Phase ─────────────────────────────────────────────────────────────

function UploadPhase({ onComplete, compact }: {
  onComplete: (resume: StoredResume, file: File, sessionId: string, results: ScoreResult[], rawText: string) => void;
  compact?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((f: File) => {
    const ok = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!ok.includes(f.type) && !f.name.match(/\.(pdf|doc|docx|txt)$/i)) {
      setError('Please upload a PDF, DOCX, or TXT file.'); return;
    }
    if (f.size > 10 * 1024 * 1024) { setError('Max file size is 10 MB.'); return; }
    setFile(f); setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const handleAnalyse = async () => {
    if (!file) return;
    if (!jobTitle.trim()) { setError('Please enter a target job title.'); return; }
    setUploading(true); setError(null);
    try {
      // Extract text client-side for accurate bullet parsing in correction checkers
      const rawText = await extractTextFromFile(file);

      const { session_id } = await createSession({
        interview_type: 'behavioral',
        candidate_name: 'Resume Analysis',
      });

      const data = await uploadCV(session_id, file);

      if (!data.success || !data.analysis) throw new Error('Analysis did not return results');

      const { results, atsScore: score, matched, missing } = computeAtsResults(data.analysis, jobDescription);

      const newResume: StoredResume = {
        id: Date.now().toString(),
        sessionId: session_id,
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        analysis: data.analysis,
        corrections: undefined,
        rawText,
        jobTitle: jobTitle.trim() || undefined,
        jobDescription: jobDescription.trim() || undefined,
        atsScore: score,
        matchedKeywords: matched,
        missingKeywords: missing,
      };

      // Persist job metadata to DB (fire-and-forget)
      saveCVMetadata(session_id, {
        job_title: jobTitle.trim() || undefined,
        job_description: jobDescription.trim() || undefined,
        ats_score: score,
        matched_keywords: matched,
        missing_keywords: missing,
      }).catch(() => {});

      onComplete(newResume, file, session_id, results, rawText);
    } catch (err) {
      setError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const uploadLabel = 'Analysing your resume...';

  return (
    <div className={compact ? '' : 'flex-1 overflow-y-auto bg-slate-950'}>
      <div className={`max-w-3xl mx-auto px-4 sm:px-6 ${compact ? 'py-2' : 'py-8 sm:py-12'}`}>
        {!compact && (
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-4">
              <Sparkles size={13} className="text-violet-400" />
              <span className="text-xs font-medium text-violet-300">AI-Powered Resume Analysis</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              Get Your ATS Score & <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                Targeted Feedback
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-3 max-w-md mx-auto leading-relaxed">
              Upload your resume to get an ATS score, keyword-match analysis, and 9 detailed correction checks with PDF highlighting.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 md:items-stretch">
          {/* CV Upload */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center">
                <FileText size={13} className="text-violet-400" />
              </div>
              <span className="text-sm font-semibold text-white">Your Resume</span>
              <span className="text-xs text-red-400">*</span>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`relative rounded-2xl transition-all duration-200 flex flex-col items-center justify-center text-center flex-1 ${
                file
                  ? 'bg-emerald-500/5 border border-emerald-500/30 cursor-default p-5'
                  : isDragOver
                    ? 'bg-violet-500/10 border-2 border-violet-500 cursor-copy p-8'
                    : 'bg-slate-800/50 border-2 border-slate-700/60 hover:border-violet-500/40 hover:bg-slate-800/70 cursor-pointer p-8'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />

              {file ? (
                <>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                    <CheckCircle2 size={22} className="text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatBytes(file.size)}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                  ><X size={14} /></button>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-3">
                    <Upload size={22} className="text-slate-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-300">
                    Drop here or <span className="text-violet-400 font-semibold">browse</span>
                  </p>
                  <p className="text-xs text-slate-600 mt-1">PDF, DOCX, TXT · max 10 MB</p>
                </>
              )}
            </div>
          </div>

          {/* Job Description */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                <Target size={13} className="text-emerald-400" />
              </div>
              <span className="text-sm font-semibold text-white">Target Job</span>
              <span className="text-xs text-red-400">*</span>
            </div>

            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Job title, e.g. Senior Software Engineer"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors mb-2"
            />

            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here to see which keywords are present or missing..."
              className="w-full flex-1 min-h-[120px] bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none transition-colors leading-relaxed"
            />

            {jobDescription.trim().length > 0 && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5 mt-1.5">
                <Zap size={11} />
                Keyword matching enabled
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 mb-4">
            <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handleAnalyse}
          disabled={!file || !jobTitle.trim() || uploading}
          className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-xl shadow-violet-500/25"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {uploadLabel}
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Analyse Resume
              {jobDescription.trim().length > 0 && <span className="text-xs opacity-70">+ JD Match</span>}
            </>
          )}
        </button>

      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type View = 'grid' | 'review';

export default function ResumePage() {
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [activeResume, setActiveResume] = useState<StoredResume | null>(null);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [atsResults, setAtsResults] = useState<ScoreResult[]>([]);
  const [view, setView] = useState<View>('grid');
  // Client-side checkers (5 of 9) — computed instantly from structured analysis
  const [clientCorrections, setClientCorrections] = useState<CheckerResult[]>([]);
  // Suggestions cache: keyed by sessionId, persists across re-opens within the same page session
  const suggestionsCache = useRef(new Map<string, StructuredSuggestion[]>());
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    getUserResumes()
      .then(({ resumes: data }) => {
        // Seed in-memory suggestions cache from DB so panel skips re-fetch on first open
        data.forEach(r => {
          if (r.session_id && r.ai_suggestions?.length) {
            suggestionsCache.current.set(r.session_id, r.ai_suggestions.map(s => ({
              summary: s.summary,
              details: s.details ?? [],
              impact: (s.impact as StructuredSuggestion['impact']) ?? 'medium',
              platforms: s.platforms ?? [],
            })));
          }
        });
        setResumes(data.map(r => ({
          id: r.session_id,
          sessionId: r.session_id,
          filename: r.filename,
          uploadedAt: r.uploaded_at,
          analysis: r.analysis as CVAnalysis,
          corrections: r.corrections as unknown as CVCorrections,
          rawText: r.raw_text || undefined,
          jobTitle: r.job_title,
          jobDescription: r.job_description,
          atsScore: r.ats_score,
          matchedKeywords: r.matched_keywords,
          missingKeywords: r.missing_keywords,
        })));
      })
      .catch(() => {
        // fallback to localStorage if API fails
        try {
          const stored: StoredResume[] = JSON.parse(localStorage.getItem('intervyu_resumes') || '[]');
          setResumes(stored);
        } catch { /* ignore */ }
      });
  }, []);

  const runAndSetClientCheckers = useCallback((analysis: CVAnalysis, rawText?: string) => {
    const results = runClientCheckers(analysis as Parameters<typeof runClientCheckers>[0], rawText);
    setClientCorrections(results);
  }, []);

  const pollCorrections = useCallback((sessionId: string) => {
    const poll = async () => {
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const res = await getCVCorrections(sessionId);
          if (res.status === 'ready' && res.corrections) {
            const corrections = res.corrections as unknown as CVCorrections;
            setActiveResume(prev => prev ? { ...prev, corrections } : prev);
            setResumes(prev => prev.map(r => r.sessionId === sessionId ? { ...r, corrections } : r));
            return;
          }
        } catch { /* non-fatal, keep polling */ }
      }
      // Polling exhausted — clear the spinner with an empty corrections object
      const empty = { checkers: [] } as unknown as CVCorrections;
      setActiveResume(prev => prev ? { ...prev, corrections: empty } : prev);
    };
    poll();
  }, []);

  const handleComplete = (resume: StoredResume, file: File, sessionId: string, results: ScoreResult[], rawText: string) => {
    setResumes(prev => [resume, ...prev]);
    setActiveResume(resume);
    setActiveFile(file);
    setAtsResults(results);
    setShowUploadModal(false);
    setView('review');
    runAndSetClientCheckers(resume.analysis, rawText);
    pollCorrections(sessionId);
  };

  const handleViewResume = (r: StoredResume) => {
    setActiveResume(r);
    setActiveFile(null);
    setView('review');
    // Recompute 6-platform ATS scores client-side from stored analysis + jobDescription
    const { results } = computeAtsResults(r.analysis, r.jobDescription);
    setAtsResults(results);
    // Run 5 client-side checkers immediately — use rawText from API if available
    runAndSetClientCheckers(r.analysis, r.rawText);
    // Poll for 4 AI-only checkers if not yet cached
    if (!r.corrections?.checkers?.length && r.sessionId) {
      pollCorrections(r.sessionId);
    }
  };

  const handleBack = () => {
    setView('grid');
    setActiveResume(null);
    setActiveFile(null);
    setAtsResults([]);
    setClientCorrections([]);
  };

  const handleDelete = (id: string) => {
    // Optimistic UI update
    setResumes(prev => prev.filter(r => r.id !== id));
    // Find sessionId — id equals sessionId for server-loaded resumes
    const sessionId = resumes.find(r => r.id === id)?.sessionId ?? id;
    deleteCV(sessionId).catch(() => {
      // Rollback on failure
      setResumes(prev => {
        const deleted = resumes.find(r => r.id === id);
        return deleted ? [deleted, ...prev] : prev;
      });
    });
  };

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {view === 'review' && (
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors -ml-1"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                {view === 'review' && activeResume ? activeResume.filename : 'Your Past Resumes'}
              </h1>
              {view === 'review' && activeResume ? (
                <p className="text-xs mt-0.5 text-slate-500">
                  {activeResume.analysis.candidateName && (
                    <span className="text-slate-300 font-medium">{activeResume.analysis.candidateName}</span>
                  )}
                  {activeResume.analysis.candidateName && activeResume.analysis.totalYearsExperience != null && (
                    <span className="mx-1.5 text-slate-600">·</span>
                  )}
                  {activeResume.analysis.totalYearsExperience != null && (
                    <span>{activeResume.analysis.totalYearsExperience} yrs · {activeResume.analysis.industry ?? 'Software Engineering'}</span>
                  )}
                </p>
              ) : (
                <p className="text-xs sm:text-sm mt-0.5 text-slate-400">
                  Track and review your analysed resumes
                </p>
              )}
            </div>
          </div>

          {view === 'review' && activeResume ? (
            <div className="flex items-center gap-2 shrink-0">
              {(() => {
                const avgScore = atsResults.length > 0
                  ? Math.round(atsResults.reduce((s, r) => s + r.overallScore, 0) / atsResults.length)
                  : (activeResume.atsScore ?? 0);
                const col = avgScore >= 80 ? 'text-emerald-400' : avgScore >= 60 ? 'text-violet-400' : 'text-amber-400';
                const issues = activeResume.corrections?.checkers?.reduce((n, c) => n + c.needsFix.length, 0) ?? 0;
                const hasCheckers = (activeResume.corrections?.checkers?.length ?? 0) > 0;
                const passCount = atsResults.filter((r) => r.passesFilter).length;
                return (<>
                  {atsResults.length > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-700/60 text-slate-400">
                      {passCount}/{atsResults.length} pass
                    </span>
                  )}
                  {hasCheckers && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${issues === 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                      {issues === 0 ? 'No issues' : `${issues} issue${issues !== 1 ? 's' : ''}`}
                    </span>
                  )}
                </>);
              })()}
            </div>
          ) : (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-opacity hover:opacity-90 shadow-md shadow-violet-500/20"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
            >
              <FileText size={14} />
              <span className="hidden sm:inline">Analyse New CV</span>
              <span className="sm:hidden">New</span>
            </button>
          )}
        </div>

        {/* Body */}
        {view === 'grid' && (
          <PastResumesGrid
            resumes={resumes}
            onView={handleViewResume}
            onNew={() => setShowUploadModal(true)}
            onDelete={handleDelete}
          />
        )}

        {view === 'review' && activeResume && (
          <div className="flex-1 overflow-hidden">
            <CVReviewer
              sessionId={activeResume.sessionId ?? ''}
              analysis={activeResume.analysis}
              corrections={mergeCorrections(clientCorrections, activeResume.corrections?.checkers ?? [])}
              atsResults={atsResults}
              jobDescription={activeResume.jobDescription}
              localPdfFile={activeFile}
              suggestionsCache={suggestionsCache.current}
              onSuggestionsCached={(sid, items) => suggestionsCache.current.set(sid, items)}
            />
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowUploadModal(false); }}
          >
            <div className="bg-slate-900 rounded-2xl border border-slate-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative shadow-2xl shadow-black/60">
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles size={15} className="text-violet-400" />
                    Analyse Your CV
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">ATS score, keyword matching &amp; correction checks</p>
                </div>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-2 py-4">
                <UploadPhase onComplete={handleComplete} compact />
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
