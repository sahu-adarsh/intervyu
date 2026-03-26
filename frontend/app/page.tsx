'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Code2, Cloud, Users, Terminal, History, FileText, ChevronDown, ChevronUp, X, Upload } from 'lucide-react';

type InterviewType = {
  id: string;
  title: string;
  description: string;
  category: string;
};

const interviewTypes: InterviewType[] = [
  { id: 'google-sde',    title: 'Google SDE',               description: 'Algorithms, data structures, system design',  category: 'Engineering' },
  { id: 'amazon-sde',   title: 'Amazon SDE',                description: 'Leadership principles, coding, behavioral',   category: 'Engineering' },
  { id: 'microsoft-sde',title: 'Microsoft SDE',             description: 'Problem solving, collaboration, design',      category: 'Engineering' },
  { id: 'aws-sa',       title: 'AWS Solutions Architect',   description: 'Cloud architecture, AWS best practices',      category: 'Cloud'       },
  { id: 'azure-sa',     title: 'Azure Solutions Architect', description: 'Azure services, enterprise solutions',        category: 'Cloud'       },
  { id: 'gcp-sa',       title: 'GCP Solutions Architect',   description: 'GCP services, data analytics',               category: 'Cloud'       },
  { id: 'behavioral',   title: 'Behavioral',                description: 'CV grilling, STAR method, experience deep dive', category: 'Behavioral' },
  { id: 'coding-round', title: 'Coding Round',              description: 'Live coding, algorithmic problems, optimization', category: 'Coding'  },
];

const categoryMeta: Record<string, { color: string; icon: React.ReactNode }> = {
  Engineering: { color: 'text-blue-400 bg-blue-400/10',    icon: <Code2 size={14} /> },
  Cloud:       { color: 'text-violet-400 bg-violet-400/10', icon: <Cloud size={14} /> },
  Behavioral:  { color: 'text-emerald-400 bg-emerald-400/10', icon: <Users size={14} /> },
  Coding:      { color: 'text-amber-400 bg-amber-400/10',  icon: <Terminal size={14} /> },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState('');

  // CV upload state
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvExpanded, setCvExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start flow state
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const canStart = selectedType && candidateName.trim() && !starting;

  const handleFileSelect = useCallback((file: File) => {
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
      return;
    }
    if (file.size > 10 * 1024 * 1024) return; // 10 MB limit
    setCvFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleStart = async () => {
    if (!canStart) return;
    setStarting(true);
    setStartError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // Create session
      const sessionRes = await fetch(`${apiUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interview_type: selectedType,
          candidate_name: candidateName.trim(),
        }),
      });
      if (!sessionRes.ok) throw new Error('Failed to create session');
      const { session_id } = await sessionRes.json();

      // Upload CV if provided (non-blocking — failure doesn't prevent interview)
      if (cvFile) {
        try {
          const fd = new FormData();
          fd.append('file', cvFile);
          await fetch(`${apiUrl}/api/interviews/${session_id}/upload-cv`, {
            method: 'POST',
            body: fd,
          });
        } catch {
          // CV upload failed silently — interview continues without CV context
        }
      }

      router.push(`/interview/new?type=${selectedType}&name=${encodeURIComponent(candidateName.trim())}&session=${session_id}`);
    } catch (err) {
      setStartError((err as Error).message || 'Something went wrong. Please try again.');
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight text-white">intervyu.io</span>
            <span className="text-xs text-slate-500 hidden sm:inline">AI-powered interview preparation</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/history')}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <History size={14} />
              <span className="hidden sm:inline">Past Interviews</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-500 hidden sm:inline">System online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 space-y-10">

        {/* Hero */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Start an Interview</h1>
          <p className="text-slate-400 text-sm max-w-lg">
            Real-time voice interview with Intervyu AI.
          </p>
        </div>

        {/* Step 1 — Interview type */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Select Interview Type</label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {interviewTypes.map((type) => {
              const isSelected = selectedType === type.id;
              const meta = categoryMeta[type.category];
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`text-left p-4 rounded-xl border transition-all duration-150 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className={`text-sm font-semibold leading-tight ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                      {type.title}
                    </h3>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center mt-0.5">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">{type.description}</p>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
                    {meta.icon}
                    {type.category}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2 — Name */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors ${selectedType ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>2</span>
            <label htmlFor="candidateName" className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Your Name</label>
          </div>
          <input
            id="candidateName"
            type="text"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            placeholder="Enter your name"
            className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
        </div>

        {/* Step 3 — Upload CV (optional) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors ${candidateName.trim() ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>3</span>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Upload CV</label>
            <span className="text-xs text-slate-600">(optional)</span>
          </div>

          <div className="max-w-md border border-slate-700 rounded-xl bg-slate-900 overflow-hidden">
            {/* Collapsible header — split into toggle area + action buttons to avoid nested buttons */}
            <div className="flex items-center px-4 py-3 hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => setCvExpanded(!cvExpanded)}>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <FileText size={15} className={cvFile ? 'text-emerald-400' : 'text-slate-500'} />
                {cvFile ? (
                  <span className="text-sm text-slate-200 truncate">
                    {cvFile.name}
                    <span className="text-slate-500 ml-2 text-xs">{formatBytes(cvFile.size)}</span>
                  </span>
                ) : (
                  <span className="text-sm text-slate-400">
                    Upload your CV — Neerja will personalise questions to your background
                  </span>
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

            {/* Expandable drop zone */}
            {cvExpanded && !cvFile && (
              <div className="px-4 pb-4">
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg px-6 py-8 text-center cursor-pointer transition-colors ${
                    isDragOver
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'
                  }`}
                >
                  <Upload size={22} className="mx-auto mb-2 text-slate-600" />
                  <p className="text-sm text-slate-400">Drop your CV here or <span className="text-blue-400">browse</span></p>
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
        </div>

        {/* Step 4 — Start */}
        <div className="space-y-3 pb-4">
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors ${canStart ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>4</span>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Begin</label>
          </div>

          {startError && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2 max-w-md">
              {startError}
            </p>
          )}

          <button
            onClick={handleStart}
            disabled={!canStart}
            className={`w-full sm:w-auto px-8 py-3 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center gap-2 ${
              canStart
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {starting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {cvFile ? 'Uploading CV & setting up...' : 'Setting up...'}
              </>
            ) : (
              canStart ? `Start Interview →` : 'Select a type and enter your name'
            )}
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-xs text-slate-600 text-center">
          Powered by AWS Bedrock · Claude Haiku 4.5 · Real-time voice
        </div>
      </footer>
    </div>
  );
}
