'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  FileText, Upload, X, Sparkles, AlertCircle, CheckCircle2,
  Target, Zap, TrendingUp, ArrowLeft, ExternalLink,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { createSession, uploadCV, getCVPresignedUrl } from '@/lib/api';
import type { CVCorrections } from '@/components/cv-reviewer/types';

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

function computeAtsScore(analysis: CVAnalysis, jdText?: string): {
  score: number; matched: string[]; missing: string[];
} {
  let score = 0;
  const allSkills = [...(analysis.skills ?? []), ...(analysis.technologies ?? [])];
  const expLen = analysis.experience?.length ?? 0;
  score += Math.min(30, expLen * 8 + ((analysis.totalYearsExperience ?? 0) > 3 ? 6 : 0));
  score += analysis.education?.length ? 20 : 0;
  score += Math.min(30, allSkills.length * 2);
  score += (analysis.candidateName ? 5 : 0) + (analysis.email ? 5 : 0) + (analysis.summary ? 10 : 0);

  let matched: string[] = [];
  let missing: string[] = [];
  if (jdText && jdText.trim().length > 20) {
    const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'are', 'you', 'will', 'have', 'from', 'our', 'your', 'their', 'into', 'must', 'able', 'also', 'been', 'more', 'new', 'can', 'not', 'its', 'any', 'all', 'who', 'was', 'had']);
    const jdKeywords = Array.from(new Set(
      jdText.toLowerCase().match(/\b[a-z][a-z0-9+#.]{2,}\b/g) ?? []
    )).filter(w => !stopWords.has(w) && w.length > 3);
    const cvLower = allSkills.map(s => s.toLowerCase());
    matched = jdKeywords.filter(kw => cvLower.some(s => s.includes(kw) || kw.includes(s))).slice(0, 12);
    missing = jdKeywords.filter(kw => !cvLower.some(s => s.includes(kw) || kw.includes(s))).slice(0, 10);
    score = Math.min(100, score + Math.round((matched.length / Math.min(jdKeywords.length, 20)) * 15));
  }
  return { score: Math.min(100, Math.round(score)), matched, missing };
}

// ─── Resume Card (for grid view) ─────────────────────────────────────────────

function ResumeCard({ resume, onView }: { resume: StoredResume; onView: () => void }) {
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
    <div className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:-translate-y-1 flex flex-col">
      {/* Card header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate" title={resume.filename}>
            {resume.filename}
          </p>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            <span>📅</span> {formatDate(resume.uploadedAt)}
            {resume.jobTitle && <span className="text-slate-300 mx-1">·</span>}
            {resume.jobTitle && <span className="truncate max-w-[120px]">{resume.jobTitle}</span>}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${scoreBg}`}>
          {score}%
        </span>
      </div>

      {/* PDF Thumbnail */}
      <div className="mx-4 mb-3 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex items-start justify-center"
        style={{ minHeight: 180 }}>
        {pdfUrl ? (
          <PDFThumbnail url={pdfUrl} width={220} />
        ) : (
          <div className="flex flex-col items-center justify-center h-[180px] w-full gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${scoreColor}22, ${scoreColor}11)` }}>
              <FileText size={18} style={{ color: scoreColor }} />
            </div>
            <p className="text-xs text-slate-400">
              {resume.sessionId ? 'Loading preview...' : 'No preview available'}
            </p>
          </div>
        )}
      </div>

      {/* Metrics row */}
      <div className="px-4 pb-3 flex items-center gap-3">
        {[
          { label: 'Skills', value: Math.min(100, (resume.analysis.skills?.length ?? 0) * 4) },
          { label: 'Exp', value: Math.min(100, (resume.analysis.experience?.length ?? 0) * 25) },
          { label: 'Edu', value: resume.analysis.education?.length ? 100 : 0 },
        ].map(m => (
          <div key={m.label} className="flex-1">
            <p className="text-[9px] text-slate-400 mb-1">{m.label}</p>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${m.value}%`, backgroundColor: scoreColor }} />
            </div>
          </div>
        ))}
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

function PastResumesGrid({ resumes, onView, onNew }: {
  resumes: StoredResume[];
  onView: (r: StoredResume) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex-1 overflow-auto bg-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Your Past Resumes</h2>
            <p className="text-sm text-slate-400 mt-0.5">Track and review your analyzed resumes</p>
          </div>
          <button
            onClick={onNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md shadow-violet-500/20 hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
          >
            <FileText size={14} />
            Analyze New CV
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {resumes.map((r) => (
            <ResumeCard key={r.id} resume={r} onView={() => onView(r)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Upload Phase ─────────────────────────────────────────────────────────────

function UploadPhase({ onComplete, onBack }: {
  onComplete: (resume: StoredResume, file: File) => void;
  onBack?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<'parsing' | 'corrections' | null>(null);
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
    setUploading(true); setError(null); setUploadStage('parsing');
    try {
      const { session_id } = await createSession({
        interview_type: 'behavioral',
        candidate_name: localStorage.getItem('intervyu_last_name') || 'Resume Analysis',
      });

      const stageTimer = setTimeout(() => setUploadStage('corrections'), 8000);
      const data = await uploadCV(session_id, file);
      clearTimeout(stageTimer);

      if (!data.success || !data.analysis) throw new Error('Analysis did not return results');

      const { score, matched, missing } = computeAtsScore(data.analysis, jobDescription);

      const newResume: StoredResume = {
        id: Date.now().toString(),
        sessionId: session_id,
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        analysis: data.analysis,
        corrections: data.corrections ?? null,
        jobTitle: jobTitle.trim() || undefined,
        jobDescription: jobDescription.trim() || undefined,
        atsScore: score,
        matchedKeywords: matched,
        missingKeywords: missing,
      };

      try {
        const stored = JSON.parse(localStorage.getItem('intervyu_resumes') || '[]');
        stored.unshift(newResume);
        localStorage.setItem('intervyu_resumes', JSON.stringify(stored));
      } catch { /* ignore */ }

      onComplete(newResume, file);
    } catch (err) {
      setError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setUploading(false); setUploadStage(null);
    }
  };

  const uploadLabel = uploadStage === 'corrections' ? 'Analysing corrections...'
    : uploadStage === 'parsing' ? 'Parsing your resume...'
    : 'Analysing your resume...';

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
          {/* CV Upload */}
          <div>
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
              className={`relative rounded-2xl transition-all duration-200 flex flex-col items-center justify-center text-center min-h-[180px] ${
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
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                <Target size={13} className="text-emerald-400" />
              </div>
              <span className="text-sm font-semibold text-white">Target Job</span>
              <span className="text-xs text-slate-500">(optional)</span>
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
              rows={5}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none transition-colors leading-relaxed"
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
          disabled={!file || uploading}
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

        <p className="text-xs text-slate-600 text-center mt-3">
          Powered by AWS Textract + Claude AI · ~20s
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type View = 'grid' | 'upload' | 'review';

export default function ResumePage() {
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [activeResume, setActiveResume] = useState<StoredResume | null>(null);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [view, setView] = useState<View>('grid');

  useEffect(() => {
    try {
      const stored: StoredResume[] = JSON.parse(localStorage.getItem('intervyu_resumes') || '[]');
      setResumes(stored);
      setView(stored.length > 0 ? 'grid' : 'upload');
    } catch {
      setView('upload');
    }
  }, []);

  const handleComplete = (resume: StoredResume, file: File) => {
    setResumes(prev => [resume, ...prev]);
    setActiveResume(resume);
    setActiveFile(file);
    setView('review');
  };

  const handleViewResume = (r: StoredResume) => {
    setActiveResume(r);
    setActiveFile(null);
    setView('review');
  };

  const handleBack = () => {
    setView(resumes.length > 0 ? 'grid' : 'upload');
    setActiveResume(null);
    setActiveFile(null);
  };

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className={`px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b flex items-center justify-between flex-shrink-0 ${
          view === 'grid' ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950'
        }`}>
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
              <h1 className={`text-lg sm:text-xl font-bold flex items-center gap-2 ${view === 'grid' ? 'text-slate-900' : 'text-white'}`}>
                <TrendingUp size={18} className="text-violet-500" />
                Resume Analyser
              </h1>
              <p className={`text-xs sm:text-sm mt-0.5 ${view === 'grid' ? 'text-slate-400' : 'text-slate-400'}`}>
                {view === 'review' && activeResume
                  ? activeResume.filename
                  : 'ATS scoring, keyword matching & AI feedback'
                }
              </p>
            </div>
          </div>

          {view !== 'review' && (
            <button
              onClick={() => setView('upload')}
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
            onNew={() => setView('upload')}
          />
        )}

        {view === 'upload' && (
          <UploadPhase
            onComplete={handleComplete}
            onBack={resumes.length > 0 ? handleBack : undefined}
          />
        )}

        {view === 'review' && activeResume && (
          <div className="flex-1 overflow-hidden">
            <CVReviewer
              sessionId={activeResume.sessionId ?? ''}
              analysis={activeResume.analysis}
              corrections={activeResume.corrections ?? null}
              atsScore={activeResume.atsScore ?? 0}
              matchedKeywords={activeResume.matchedKeywords}
              missingKeywords={activeResume.missingKeywords}
              localPdfFile={activeFile}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
