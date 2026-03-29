'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  FileText, Upload, X, Sparkles, AlertCircle, CheckCircle2,
  Briefcase, GraduationCap, Code2, User, RotateCcw, Target,
  TrendingUp, Zap, ChevronRight, Circle,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { createSession, uploadCV } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CVAnalysis {
  candidateName: string;
  email: string;
  phone: string;
  skills: string[];
  technologies: string[];
  experience: Array<{ duration: string; context: string }>;
  education: Array<{ degree: string; context: string }>;
  totalYearsExperience: number;
  summary: string;
}

interface StoredResume {
  id: string;
  filename: string;
  uploadedAt: string;
  analysis: CVAnalysis;
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

/** Compute a completeness-based ATS score from the analysis */
function computeAtsScore(analysis: CVAnalysis, jdText?: string): {
  score: number;
  hardSkills: number;
  softSkills: number;
  experience: number;
  education: number;
  matched: string[];
  missing: string[];
} {
  let score = 0;
  const allSkills = [...(analysis.skills || []), ...(analysis.technologies || [])];

  // Experience (30 pts)
  const expLen = analysis.experience?.length || 0;
  const expScore = Math.min(30, expLen * 8 + (analysis.totalYearsExperience > 3 ? 6 : 0));
  score += expScore;

  // Education (20 pts)
  const eduScore = analysis.education?.length > 0 ? 20 : 0;
  score += eduScore;

  // Skills / hard (30 pts)
  const skillScore = Math.min(30, allSkills.length * 2);
  score += skillScore;

  // Profile completeness (20 pts)
  const profileScore =
    (analysis.candidateName ? 5 : 0) +
    (analysis.email ? 5 : 0) +
    (analysis.summary ? 10 : 0);
  score += profileScore;

  // JD keyword matching — adjusts score up or down
  let matched: string[] = [];
  let missing: string[] = [];

  if (jdText && jdText.trim().length > 20) {
    const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'are', 'you', 'will', 'have', 'from', 'our', 'your', 'their', 'into', 'must', 'able', 'also', 'been', 'more', 'new', 'can', 'not', 'its', 'any', 'all', 'who', 'was', 'had']);
    const jdKeywords = Array.from(new Set(
      jdText.toLowerCase().match(/\b[a-z][a-z0-9+#.]{2,}\b/g) || []
    )).filter(w => !stopWords.has(w) && w.length > 3);

    const cvLower = allSkills.map(s => s.toLowerCase());
    matched = jdKeywords.filter(kw =>
      cvLower.some(skill => skill.includes(kw) || kw.includes(skill))
    ).slice(0, 12);
    missing = jdKeywords.filter(kw =>
      !cvLower.some(skill => skill.includes(kw) || kw.includes(skill))
    ).slice(0, 10);

    // Boost score by keyword match rate (up to +15)
    const matchRate = jdKeywords.length > 0 ? matched.length / Math.min(jdKeywords.length, 20) : 0;
    score = Math.min(100, score + Math.round(matchRate * 15));
  }

  return {
    score: Math.min(100, Math.round(score)),
    hardSkills: Math.min(100, Math.round((skillScore / 30) * 100)),
    softSkills: Math.min(100, Math.round((profileScore / 20) * 100)),
    experience: Math.min(100, Math.round((expScore / 30) * 100)),
    education: Math.min(100, Math.round((eduScore / 20) * 100)),
    matched,
    missing,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#a78bfa' : '#f59e0b';

  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-white leading-none">{score}</span>
        <span className="text-xs text-slate-500 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-semibold text-white">{value}%</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function SkillChip({ label, variant }: { label: string; variant: 'matched' | 'missing' | 'neutral' }) {
  const styles = {
    matched: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    missing: 'bg-red-500/10 text-red-400 border-red-500/20',
    neutral: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[variant]}`}>
      {label}
    </span>
  );
}

// ─── Upload Phase ─────────────────────────────────────────────────────────────

function UploadPhase({ onComplete }: {
  onComplete: (resume: StoredResume) => void;
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
      setError('Please upload a PDF, DOCX, or TXT file.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) { setError('Max file size is 10 MB.'); return; }
    setFile(f);
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const handleAnalyse = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { session_id } = await createSession({
        interview_type: 'behavioral',
        candidate_name: localStorage.getItem('intervyu_last_name') || 'Resume Analysis',
      });

      const data = await uploadCV(session_id, file);
      if (!data.success || !data.analysis) throw new Error('Analysis did not return results');

      const { score, hardSkills, softSkills, experience, education, matched, missing } =
        computeAtsScore(data.analysis, jobDescription);

      const newResume: StoredResume = {
        id: Date.now().toString(),
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        analysis: data.analysis,
        jobTitle: jobTitle.trim() || undefined,
        jobDescription: jobDescription.trim() || undefined,
        atsScore: score,
        matchedKeywords: matched,
        missingKeywords: missing,
      };

      // Persist
      try {
        const stored = JSON.parse(localStorage.getItem('intervyu_resumes') || '[]');
        stored.unshift(newResume);
        localStorage.setItem('intervyu_resumes', JSON.stringify(stored));
      } catch { /* ignore */ }

      onComplete(newResume);
    } catch (err) {
      setError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero text */}
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
            Upload your resume and optionally paste a job description to get keyword-match analysis and personalised improvement suggestions.
          </p>
        </div>

        {/* Two-column upload form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
          {/* CV Upload */}
          <div className="space-y-2">
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
              className={`relative border-2 border-dashed rounded-2xl transition-all duration-200 flex flex-col items-center justify-center text-center min-h-[180px] ${
                file
                  ? 'border-emerald-500/40 bg-emerald-500/5 cursor-default p-5'
                  : isDragOver
                    ? 'border-violet-500 bg-violet-500/10 cursor-copy p-8'
                    : 'border-slate-700 hover:border-violet-500/50 hover:bg-slate-800/20 cursor-pointer p-8'
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
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                <Target size={13} className="text-emerald-400" />
              </div>
              <span className="text-sm font-semibold text-white">Target Job</span>
              <span className="text-xs text-slate-500">(optional — unlocks keyword match)</span>
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
              placeholder="Paste the job description here to see which required keywords are present or missing in your resume..."
              rows={5}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none transition-colors leading-relaxed"
            />

            {jobDescription.trim().length > 0 && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <Zap size={11} />
                Keyword matching enabled — {jobDescription.trim().split(/\s+/).length} words detected
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
          className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xl shadow-violet-500/25"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analysing your resume...
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
          Powered by AWS Textract + Claude AI · Analysis takes ~10s
        </p>
      </div>
    </div>
  );
}

// ─── Results Phase ────────────────────────────────────────────────────────────

function ResultsView({ resume, onReplace }: { resume: StoredResume; onReplace: () => void }) {
  const { analysis, atsScore = 0, matchedKeywords = [], missingKeywords = [] } = resume;
  const hasJD = (resume.jobDescription?.trim().length || 0) > 0;

  // Recompute metric breakdowns
  const allSkills = [...(analysis.skills || []), ...(analysis.technologies || [])];
  const expScore = Math.min(100, ((analysis.experience?.length || 0) * 8 + (analysis.totalYearsExperience > 3 ? 6 : 0)) / 30 * 100);
  const eduScore = analysis.education?.length > 0 ? 100 : 0;
  const skillScore = Math.min(100, allSkills.length * 2 / 30 * 100);
  const profileScore = ((analysis.candidateName ? 5 : 0) + (analysis.email ? 5 : 0) + (analysis.summary ? 10 : 0)) / 20 * 100;

  const scoreColor = atsScore >= 80 ? 'text-emerald-400' : atsScore >= 60 ? 'text-violet-400' : 'text-amber-400';
  const scoreLabel = atsScore >= 80 ? 'Strong' : atsScore >= 60 ? 'Good' : 'Needs Work';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">{resume.filename}</h2>
          <p className="text-xs text-slate-500">Analysed {formatDate(resume.uploadedAt)}{resume.jobTitle ? ` · ${resume.jobTitle}` : ''}</p>
        </div>
        <button
          onClick={onReplace}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <RotateCcw size={12} />
          New Analysis
        </button>
      </div>

      {/* ATS Score card */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <ScoreRing score={atsScore} />
          <div className="flex-1 w-full">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">ATS Score</p>
              <span className={`text-xs font-bold ${scoreColor}`}>{scoreLabel}</span>
            </div>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              {atsScore >= 80
                ? 'Your resume is well-optimised. Focus on tailoring keywords for each specific role.'
                : atsScore >= 60
                  ? 'Good foundation. Adding more quantified achievements and skills can push this higher.'
                  : 'Your resume needs more detail. Add specific skills, quantified impact, and complete experience.'}
            </p>
            <div className="space-y-2.5">
              <MetricBar label="Hard Skills" value={Math.round(skillScore)} color="bg-blue-500" />
              <MetricBar label="Experience" value={Math.round(expScore)} color="bg-violet-500" />
              <MetricBar label="Education" value={Math.round(eduScore)} color="bg-emerald-500" />
              <MetricBar label="Profile Completeness" value={Math.round(profileScore)} color="bg-amber-500" />
            </div>
          </div>
        </div>
      </div>

      {/* JD Keyword match */}
      {hasJD && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={15} className="text-emerald-400" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Keyword Match</p>
            <span className="ml-auto text-xs font-bold text-emerald-400">
              {matchedKeywords.length} matched
            </span>
          </div>

          {matchedKeywords.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={11} className="text-emerald-400" />
                Present in your resume
              </p>
              <div className="flex flex-wrap gap-1.5">
                {matchedKeywords.map(k => <SkillChip key={k} label={k} variant="matched" />)}
              </div>
            </div>
          )}

          {missingKeywords.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                <Circle size={11} className="text-red-400" />
                Missing — consider adding if relevant
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missingKeywords.map(k => <SkillChip key={k} label={k} variant="missing" />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Summary */}
      {analysis.summary && (
        <div className="bg-gradient-to-br from-violet-600/10 to-indigo-600/5 border border-violet-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-violet-400" />
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest">AI Summary</p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>
        </div>
      )}

      {/* Experience */}
      {analysis.experience?.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase size={14} className="text-slate-500" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Experience</p>
            <span className="ml-auto text-xs text-slate-600">{analysis.totalYearsExperience} yrs total</span>
          </div>
          <div className="space-y-3">
            {analysis.experience.map((exp, i) => (
              <div key={i} className="flex gap-3">
                <ChevronRight size={14} className="text-violet-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">{exp.duration}</p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{exp.context}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {analysis.education?.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap size={14} className="text-slate-500" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Education</p>
          </div>
          <div className="space-y-3">
            {analysis.education.map((edu, i) => (
              <div key={i} className="flex gap-3">
                <ChevronRight size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">{edu.degree}</p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{edu.context}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {allSkills.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Code2 size={14} className="text-slate-500" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Skills & Technologies</p>
            <span className="ml-auto text-xs text-slate-600">{allSkills.length} extracted</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allSkills.slice(0, 30).map((s, i) => <SkillChip key={i} label={s} variant="neutral" />)}
          </div>
        </div>
      )}

      {/* Profile */}
      {(analysis.candidateName || analysis.email) && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={14} className="text-slate-500" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Extracted Profile</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { label: 'Name', value: analysis.candidateName },
              { label: 'Email', value: analysis.email },
              { label: 'Phone', value: analysis.phone },
            ].filter(r => r.value).map(r => (
              <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-slate-700/40 last:border-0">
                <span className="text-xs text-slate-500">{r.label}</span>
                <span className="text-xs font-medium text-slate-200 truncate max-w-[60%] text-right">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResumePage() {
  const [resumes, setResumes] = useState<StoredResume[]>([]);
  const [activeResume, setActiveResume] = useState<StoredResume | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    try {
      const stored: StoredResume[] = JSON.parse(localStorage.getItem('intervyu_resumes') || '[]');
      setResumes(stored);
      if (stored.length > 0) setActiveResume(stored[0]);
      else setShowUpload(true);
    } catch {
      setShowUpload(true);
    }
  }, []);

  const handleComplete = (resume: StoredResume) => {
    setResumes(prev => [resume, ...prev]);
    setActiveResume(resume);
    setShowUpload(false);
  };

  const isListView = resumes.length > 0 && !showUpload;

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp size={18} className="text-violet-400" />
              Resume Analyser
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">ATS scoring, keyword matching &amp; AI feedback</p>
          </div>
          {isListView && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20"
            >
              <FileText size={14} />
              <span className="hidden sm:inline">Analyse New CV</span>
              <span className="sm:hidden">New</span>
            </button>
          )}
        </div>

        {/* Body */}
        {!isListView ? (
          <UploadPhase onComplete={handleComplete} />
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar — past resumes */}
            <div className="w-56 sm:w-64 flex-shrink-0 border-r border-slate-800 overflow-y-auto p-3 sm:p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-2 mb-3">
                {resumes.length} {resumes.length === 1 ? 'Analysis' : 'Analyses'}
              </p>
              <div className="space-y-1.5">
                {resumes.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setActiveResume(r); setShowUpload(false); }}
                    className={`w-full text-left p-3 rounded-xl transition-all border ${
                      activeResume?.id === r.id && !showUpload
                        ? 'bg-violet-600/10 border-violet-500/30'
                        : 'border-transparent hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        activeResume?.id === r.id && !showUpload ? 'bg-violet-500/20' : 'bg-slate-800'
                      }`}>
                        <FileText size={13} className={activeResume?.id === r.id && !showUpload ? 'text-violet-400' : 'text-slate-500'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-200 truncate">{r.filename}</p>
                        <p className="text-xs text-slate-500">{formatDate(r.uploadedAt)}</p>
                        {r.atsScore !== undefined && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className={`h-1 rounded-full flex-1 bg-slate-700 overflow-hidden`}>
                              <div
                                className={`h-full rounded-full ${r.atsScore >= 80 ? 'bg-emerald-500' : r.atsScore >= 60 ? 'bg-violet-500' : 'bg-amber-500'}`}
                                style={{ width: `${r.atsScore}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-bold ${r.atsScore >= 80 ? 'text-emerald-400' : r.atsScore >= 60 ? 'text-violet-400' : 'text-amber-400'}`}>
                              {r.atsScore}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right — analysis detail */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="max-w-2xl">
                {activeResume && (
                  <ResultsView
                    resume={activeResume}
                    onReplace={() => setShowUpload(true)}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
