'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type InterviewType = {
  id: string;
  title: string;
  description: string;
  category: string;
};

const interviewTypes: InterviewType[] = [
  {
    id: 'google-sde',
    title: 'Google SDE',
    description: 'Algorithms, data structures, system design',
    category: 'Engineering'
  },
  {
    id: 'amazon-sde',
    title: 'Amazon SDE',
    description: 'Leadership principles, coding, behavioral',
    category: 'Engineering'
  },
  {
    id: 'microsoft-sde',
    title: 'Microsoft SDE',
    description: 'Problem solving, collaboration, design',
    category: 'Engineering'
  },
  {
    id: 'aws-sa',
    title: 'AWS Solutions Architect',
    description: 'Cloud architecture, AWS best practices',
    category: 'Cloud'
  },
  {
    id: 'azure-sa',
    title: 'Azure Solutions Architect',
    description: 'Azure services, enterprise solutions',
    category: 'Cloud'
  },
  {
    id: 'gcp-sa',
    title: 'GCP Solutions Architect',
    description: 'GCP services, data analytics',
    category: 'Cloud'
  },
  {
    id: 'behavioral',
    title: 'Behavioral',
    description: 'CV grilling, STAR method, experience deep dive',
    category: 'Behavioral'
  },
  {
    id: 'coding-round',
    title: 'Coding Round',
    description: 'Live coding, algorithmic problems, optimization',
    category: 'Coding'
  }
];

const categoryColors: Record<string, string> = {
  Engineering: 'text-blue-400 bg-blue-400/10',
  Cloud: 'text-violet-400 bg-violet-400/10',
  Behavioral: 'text-emerald-400 bg-emerald-400/10',
  Coding: 'text-amber-400 bg-amber-400/10',
};

export default function Home() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState('');

  const handleStartInterview = () => {
    if (!selectedType || !candidateName.trim()) return;
    router.push(`/interview/new?type=${selectedType}&name=${encodeURIComponent(candidateName)}`);
  };

  const canStart = selectedType && candidateName.trim();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold tracking-tight text-white">intervyu.io</span>
            <span className="ml-3 text-xs text-slate-500 hidden sm:inline">AI-powered interview preparation</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="System online" />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 space-y-10">

        {/* Hero */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Start an Interview</h1>
          <p className="text-slate-400 text-sm">
            Real-time voice interview with AI. Select a type, enter your name, and begin.
          </p>
        </div>

        {/* Name input */}
        <div className="space-y-2">
          <label htmlFor="candidateName" className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Your Name
          </label>
          <input
            id="candidateName"
            type="text"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStartInterview()}
            placeholder="Enter your name"
            className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
        </div>

        {/* Interview type grid */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">
            Interview Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {interviewTypes.map((type) => {
              const isSelected = selectedType === type.id;
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
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[type.category]}`}>
                    {type.category}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="pt-2">
          <button
            onClick={handleStartInterview}
            disabled={!canStart}
            className={`px-8 py-3 rounded-lg text-sm font-semibold transition-all duration-150 ${
              canStart
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {canStart ? `Start Interview →` : 'Select a type and enter your name'}
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-5">
        <div className="max-w-5xl mx-auto px-6 text-xs text-slate-600 text-center">
          Powered by AWS Bedrock · Claude Haiku 4.5 · Real-time voice
        </div>
      </footer>
    </div>
  );
}
