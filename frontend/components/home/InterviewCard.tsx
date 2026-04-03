'use client';

import Image from 'next/image';
import { FileSearch } from 'lucide-react';

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

// ─── Brand strip config ──────────────────────────────────────────────────────

const BRAND_MAP: Record<string, { bg: string; logo: React.ReactNode }> = {
  'google-sde':    {
    bg: 'bg-white',
    logo: <Image src="/Google Logo.png" alt="Google" width={80} height={40} className="object-contain" />,
  },
  'amazon-sde':    {
    bg: 'bg-[#232F3E]',
    logo: <Image src="/Amazon S3 NRF 2019.png" alt="Amazon" width={80} height={40} className="object-contain" />,
  },
  'microsoft-sde': {
    bg: 'bg-[#1E1E1E]',
    logo: <Image src="/Microsoft Logo.png" alt="Microsoft" width={80} height={40} className="object-contain" />,
  },
  'aws-sa':        {
    bg: 'bg-[#232F3E]',
    logo: <Image src="/Amazon AWS Logo.png" alt="AWS" width={80} height={40} className="object-contain" />,
  },
  'azure-sa':      {
    bg: 'bg-[#1a1a2e]',
    logo: <Image src="/Microsoft Azure Logo.png" alt="Azure" width={80} height={40} className="object-contain" />,
  },
  'gcp-sa':        {
    bg: 'bg-white',
    logo: <Image src="/Google Cloud Platform Wallpaper.png" alt="Google Cloud" width={80} height={40} className="object-contain" />,
  },
  'behavioral':    {
    bg: 'bg-gradient-to-br from-emerald-950 to-teal-900',
    logo: <FileSearch className="h-10 w-10 text-emerald-300" />,
  },
  'coding-round':  {
    bg: 'bg-gradient-to-br from-violet-950 to-[#0d1117]',
    logo: <Image src="/Computer Icons Code Symbol.png" alt="Coding" width={60} height={60} className="object-contain" />,
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
