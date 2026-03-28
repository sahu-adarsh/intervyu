'use client';

import { Users, Terminal } from 'lucide-react';

export interface InterviewCardConfig {
  id: string;
  title: string;
  company: string;
  role: string;
  description: string;
  category: string;
  difficulty: 'Medium' | 'Hard';
}

interface InterviewCardProps extends InterviewCardConfig {
  onStart: (id: string) => void;
}

// ─── Inline brand logos — zero external deps, ad-blocker proof ──────────────

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10">
      <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.3 33.3 30 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 2.9l6.1-6.1C34.4 5.2 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.5 20-21 0-1.4-.1-2.7-.5-4z" />
      <path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16.2 19.2 13 24 13c3.1 0 5.9 1.1 8 2.9l6.1-6.1C34.4 5.2 29.5 3 24 3 16.2 3 9.5 7.9 6.3 14.7z" />
      <path fill="#FBBC05" d="M24 45c5.4 0 10.3-1.9 14.1-5l-6.5-5.5C29.6 36 26.9 37 24 37c-5.9 0-10.9-3.9-12.7-9.3l-7 5.4C7.9 40.5 15.4 45 24 45z" />
      <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.4-2.4 4.4-4.4 5.8l6.5 5.5C41.5 36.5 44.5 31 44.5 24c0-1.3-.2-2.7-.5-4z" />
    </svg>
  );
}

function AmazonLogo() {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-white font-bold text-xl tracking-tight leading-none" style={{ fontFamily: 'Arial, sans-serif' }}>amazon</span>
      {/* Amazon smile */}
      <svg viewBox="0 0 100 20" className="w-16 h-3">
        <path d="M10 5 Q50 20 90 5" stroke="#FF9900" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M82 3 L90 5 L85 11" stroke="#FF9900" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid grid-cols-2 gap-[3px]">
        <div className="w-[18px] h-[18px] bg-[#F25022]" />
        <div className="w-[18px] h-[18px] bg-[#7FBA00]" />
        <div className="w-[18px] h-[18px] bg-[#00A4EF]" />
        <div className="w-[18px] h-[18px] bg-[#FFB900]" />
      </div>
      <span className="text-white font-semibold text-sm tracking-tight">Microsoft</span>
    </div>
  );
}

function AWSLogo() {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[#FF9900] font-black text-2xl tracking-widest leading-none">aws</span>
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-1 h-1 rounded-full bg-[#FF9900] opacity-60" />
        ))}
      </div>
    </div>
  );
}

function AzureLogo() {
  return (
    <div className="flex items-center gap-2">
      {/* Azure icon - simplified delta/triangle */}
      <svg viewBox="0 0 96 96" className="h-9 w-9">
        <defs>
          <linearGradient id="az1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#114A8B" />
            <stop offset="100%" stopColor="#0078D4" />
          </linearGradient>
          <linearGradient id="az2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0078D4" />
            <stop offset="100%" stopColor="#5EA0EF" />
          </linearGradient>
        </defs>
        <path fill="url(#az1)" d="M33.7 6h28.1L36.6 90H8.5z" />
        <path fill="url(#az2)" d="M60.5 6h26.6L52.4 55.3 87.5 90H52.4L36.6 55.3z" />
      </svg>
      <span className="text-white font-bold text-base">Azure</span>
    </div>
  );
}

function GCPLogo() {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 64 64" className="h-9 w-9">
        <path fill="#4285F4" d="M32 8C18.7 8 8 18.7 8 32s10.7 24 24 24 24-10.7 24-24S45.3 8 32 8zm0 4c11 0 20 9 20 20s-9 20-20 20S12 43 12 32s9-20 20-20z" />
        <path fill="#EA4335" d="M32 20a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm0 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16z" />
        <circle fill="#FBBC05" cx="32" cy="14" r="4" />
        <circle fill="#34A853" cx="32" cy="50" r="4" />
        <circle fill="#4285F4" cx="14" cy="32" r="4" />
        <circle fill="#EA4335" cx="50" cy="32" r="4" />
      </svg>
      <span className="text-[#4285F4] text-[10px] font-semibold tracking-wide">Google Cloud</span>
    </div>
  );
}

// ─── Brand strip config ──────────────────────────────────────────────────────

const BRAND_MAP: Record<string, { bg: string; logo: React.ReactNode }> = {
  'google-sde':    { bg: 'bg-white',        logo: <GoogleLogo /> },
  'amazon-sde':    { bg: 'bg-[#232F3E]',    logo: <AmazonLogo /> },
  'microsoft-sde': { bg: 'bg-[#1E1E1E]',    logo: <MicrosoftLogo /> },
  'aws-sa':        { bg: 'bg-[#232F3E]',    logo: <AWSLogo /> },
  'azure-sa':      { bg: 'bg-[#0078D4]',    logo: <AzureLogo /> },
  'gcp-sa':        { bg: 'bg-white',        logo: <GCPLogo /> },
  'behavioral':    {
    bg: 'bg-gradient-to-br from-emerald-900 to-slate-800',
    logo: <Users className="h-10 w-10 text-emerald-400" />,
  },
  'coding-round':  {
    bg: 'bg-gradient-to-br from-slate-900 to-[#0d1117]',
    logo: <Terminal className="h-10 w-10 text-green-400" />,
  },
};

const categoryColors: Record<string, string> = {
  Engineering: 'text-blue-400 bg-blue-400/10',
  Cloud:       'text-violet-400 bg-violet-400/10',
  Behavioral:  'text-emerald-400 bg-emerald-400/10',
  Coding:      'text-amber-400 bg-amber-400/10',
};

export default function InterviewCard({ id, company, role, description, category, difficulty, onStart }: InterviewCardProps) {
  const brand = BRAND_MAP[id] ?? {
    bg: 'bg-slate-700',
    logo: <span className="text-2xl font-bold text-slate-300">{company[0]}</span>,
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-200 group flex flex-col">
      {/* Brand strip */}
      <div className={`h-20 flex items-center justify-center ${brand.bg}`}>
        {brand.logo}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <div>
          <p className="text-xs text-slate-500 font-medium">{company}</p>
          <h3 className="text-sm font-semibold text-white leading-snug">{role}</h3>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${categoryColors[category] || 'text-slate-400 bg-slate-700'}`}>
            {category}
          </span>
          <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${difficulty === 'Hard' ? 'text-red-400 bg-red-400/10' : 'text-amber-400 bg-amber-400/10'}`}>
            {difficulty}
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed flex-1 line-clamp-3">{description}</p>

        <button
          onClick={() => onStart(id)}
          className="mt-1 w-full py-2 rounded-xl bg-slate-800 hover:bg-violet-600 text-slate-400 hover:text-white text-xs font-semibold transition-all duration-200 border border-slate-700 hover:border-violet-500"
        >
          Start Interview →
        </button>
      </div>
    </div>
  );
}
