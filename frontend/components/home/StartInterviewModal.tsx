'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ChevronDown, ChevronUp, X, Upload, Clock } from 'lucide-react';
import { createSession, uploadCV, getUserResumes, linkResume } from '@/lib/api';
import { useSupabaseSession, getUserDisplayName } from '@/lib/supabase/auth';
import { posthog } from '@/lib/posthog';

interface InterviewTypeInfo {
  id: string;
  title: string;
}

interface StartInterviewModalProps {
  interviewType: InterviewTypeInfo | null;
  onClose: () => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type SavedResume = {
  session_id: string;
  filename: string;
  uploaded_at: string | null;
  analysis: Record<string, unknown>;
};

export default function StartInterviewModal({ interviewType, onClose }: StartInterviewModalProps) {
  const router = useRouter();
  const { user } = useSupabaseSession();
  const [candidateName, setCandidateName] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvExpanded, setCvExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [cvMode, setCvMode] = useState<'upload' | 'saved'>('upload');
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canStart = interviewType && candidateName.trim() && !starting;

  // Pre-fill name from Supabase user metadata (Google/GitHub provides full_name)
  useEffect(() => {
    if (user) {
      const displayName = getUserDisplayName(user);
      if (displayName) setCandidateName(displayName);
    }
  }, [user]);

  // Scroll lock
  useEffect(() => {
    if (interviewType) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [interviewType]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Fetch saved resumes when switching to saved mode
  useEffect(() => {
    if (cvMode !== 'saved' || savedResumes.length > 0) return;
    setLoadingResumes(true);
    getUserResumes()
      .then(({ resumes }) => setSavedResumes(resumes))
      .catch(() => {})
      .finally(() => setLoadingResumes(false));
  }, [cvMode, savedResumes.length]);

  const handleFileSelect = useCallback((file: File) => {
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) return;
    if (file.size > 10 * 1024 * 1024) return;
    setCvFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleStart = async () => {
    if (!canStart || !interviewType) return;
    setStarting(true);
    setStartError(null);

    try {
      const { session_id } = await createSession({
        interview_type: interviewType.id,
        candidate_name: candidateName.trim(),
      });

      if (cvMode === 'upload' && cvFile) {
        try {
          await uploadCV(session_id, cvFile);
        } catch {
          // CV upload failed silently — interview continues without CV context
        }
      } else if (cvMode === 'saved' && selectedResumeId) {
        try {
          await linkResume(session_id, selectedResumeId);
        } catch {
          // Link failed silently — interview continues without CV context
        }
      }

      posthog.capture('interview_started', {
        interview_type: interviewType.id,
        interview_title: interviewType.title,
        session_id,
        has_cv: !!(cvFile || selectedResumeId),
      });

      router.push(`/interview/new?type=${interviewType.id}&name=${encodeURIComponent(candidateName.trim())}&session=${session_id}`);
    } catch (err) {
      setStartError((err as Error).message || 'Something went wrong. Please try again.');
      setStarting(false);
    }
  };

  if (!interviewType) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Starting Interview</p>
            <h2 className="text-lg font-bold text-white">{interviewType.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Name input */}
        <div className="space-y-2 mb-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Your Name</label>
          <input
            type="text"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            placeholder="Enter your name"
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          />
        </div>

        {/* CV section */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Resume <span className="text-slate-600 normal-case font-normal">(optional)</span>
            </label>
            {/* Toggle */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => { setCvMode('upload'); setSelectedResumeId(null); }}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${cvMode === 'upload' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Upload new
              </button>
              <button
                onClick={() => { setCvMode('saved'); setCvFile(null); }}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${cvMode === 'saved' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Use saved
              </button>
            </div>
          </div>

          {cvMode === 'upload' && (
            <div className="border border-slate-700 rounded-xl bg-slate-900/50 overflow-hidden">
              <div
                className="flex items-center px-4 py-3 hover:bg-slate-800/50 transition-colors cursor-pointer"
                onClick={() => setCvExpanded(!cvExpanded)}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <FileText size={15} className={cvFile ? 'text-emerald-400' : 'text-slate-500'} />
                  {cvFile ? (
                    <span className="text-sm text-slate-200 truncate">
                      {cvFile.name}
                      <span className="text-slate-500 ml-2 text-xs">{formatBytes(cvFile.size)}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">Personalise Neerja&apos;s questions with your CV</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {cvFile && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setCvFile(null); }}
                      className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                  {cvExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                </div>
              </div>

              {cvExpanded && !cvFile && (
                <div className="px-4 pb-4">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg px-6 py-7 text-center cursor-pointer transition-colors ${
                      isDragOver
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'
                    }`}
                  >
                    <Upload size={20} className="mx-auto mb-2 text-slate-600" />
                    <p className="text-sm text-slate-400">Drop here or <span className="text-violet-400">browse</span></p>
                    <p className="text-xs text-slate-600 mt-1">PDF, DOCX, TXT · max 10 MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) { handleFileSelect(f); setCvExpanded(false); }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {cvMode === 'saved' && (
            <div className="border border-slate-700 rounded-xl bg-slate-900/50 overflow-hidden">
              {loadingResumes ? (
                <div className="flex items-center justify-center gap-2 py-6 text-slate-500 text-sm">
                  <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
                  Loading saved resumes...
                </div>
              ) : savedResumes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-1 text-center px-4">
                  <FileText size={20} className="text-slate-600 mb-1" />
                  <p className="text-sm text-slate-400">No saved resumes yet</p>
                  <p className="text-xs text-slate-600">Upload a CV in a previous interview to save it here</p>
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-800">
                  {savedResumes.map((r) => (
                    <button
                      key={r.session_id}
                      onClick={() => setSelectedResumeId(r.session_id === selectedResumeId ? null : r.session_id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        selectedResumeId === r.session_id
                          ? 'bg-violet-900/30 border-l-2 border-violet-500'
                          : 'hover:bg-slate-800/50 border-l-2 border-transparent'
                      }`}
                    >
                      <FileText size={14} className={selectedResumeId === r.session_id ? 'text-violet-400 flex-shrink-0' : 'text-slate-500 flex-shrink-0'} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{r.filename || 'Unnamed resume'}</p>
                        {r.uploaded_at && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock size={10} />
                            {new Date(r.uploaded_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {selectedResumeId === r.session_id && (
                        <div className="w-4 h-4 rounded-full bg-violet-500 flex-shrink-0 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {startError && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2 mb-4">
            {startError}
          </p>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 ${
            canStart
              ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {starting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {cvFile ? 'Uploading CV & setting up...' : selectedResumeId ? 'Linking resume & setting up...' : 'Setting up...'}
            </>
          ) : (
            canStart ? 'Start Interview →' : 'Enter your name to continue'
          )}
        </button>
      </div>
    </div>
  );
}
