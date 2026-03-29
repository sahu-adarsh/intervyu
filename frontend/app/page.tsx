'use client';

import { useState, useEffect } from 'react';
import { Search, Video, BarChart2, CalendarPlus, Calendar, Play, Trash2, Menu } from 'lucide-react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import InterviewCard, { type InterviewCardConfig } from '@/components/home/InterviewCard';
import StartInterviewModal from '@/components/home/StartInterviewModal';
import PastInterviewsList from '@/components/home/PastInterviewsList';
import StatsCard from '@/components/home/StatsCard';
import ScheduleModal, { type ScheduledInterview } from '@/components/home/ScheduleModal';
import { useRequireAuth, getUserDisplayName } from '@/lib/supabase/auth';

const interviewTypes: InterviewCardConfig[] = [
  {
    id: 'google-sde',
    title: 'Google SDE Technical Interview',
    company: 'Google',
    role: 'SDE Technical Interview',
    description: 'Designed to evaluate technical depth, problem-solving ability, and behavioral fit.',
    category: 'Engineering',
    difficulty: 'Hard',
  },
  {
    id: 'amazon-sde',
    title: 'Amazon SDE Interview',
    company: 'Amazon',
    role: 'SDE Interview',
    description: 'Leadership principles, coding challenges, and behavioral questions in Amazon style.',
    category: 'Engineering',
    difficulty: 'Hard',
  },
  {
    id: 'microsoft-sde',
    title: 'Microsoft SDE Interview',
    company: 'Microsoft',
    role: 'SDE Interview',
    description: 'Problem solving, collaboration, and system design evaluated by Microsoft standards.',
    category: 'Engineering',
    difficulty: 'Hard',
  },
  {
    id: 'aws-sa',
    title: 'AWS Solutions Architect',
    company: 'Amazon Web Services',
    role: 'Solutions Architect',
    description: 'Cloud architecture, AWS best practices, and scalable system design patterns.',
    category: 'Cloud',
    difficulty: 'Medium',
  },
  {
    id: 'azure-sa',
    title: 'Azure Solutions Architect',
    company: 'Microsoft Azure',
    role: 'Solutions Architect',
    description: 'Azure services, enterprise solutions, and cloud migration strategies.',
    category: 'Cloud',
    difficulty: 'Medium',
  },
  {
    id: 'gcp-sa',
    title: 'GCP Solutions Architect',
    company: 'Google Cloud',
    role: 'Solutions Architect',
    description: 'GCP services, data analytics platforms, and cloud-native architecture.',
    category: 'Cloud',
    difficulty: 'Medium',
  },
  {
    id: 'behavioral',
    title: 'CV Grilling',
    company: 'General Prep',
    role: 'CV Grilling',
    description: 'Dive deep into your resume to test self-awareness, clarity of experience, and career story.',
    category: 'Behavioral',
    difficulty: 'Medium',
  },
  {
    id: 'coding-round',
    title: 'Coding Round',
    company: 'General Prep',
    role: 'Coding Round',
    description: 'Solve DSA problems to assess your logical thinking, problem-solving approach, and code clarity.',
    category: 'Coding',
    difficulty: 'Hard',
  },
];

const filters = ['All', 'Engineering', 'Cloud', 'Behavioral', 'Coding'];

interface StoredSession {
  sessionId: string;
  interviewType: string;
  candidateName: string;
  date: string;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatScheduledDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}

function ScheduledSection({
  scheduled,
  onStart,
  onDelete,
  onAdd,
}: {
  scheduled: ScheduledInterview[];
  onStart: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  const upcoming = scheduled.filter(
    (s) => new Date(s.scheduledAt).getTime() > Date.now()
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Scheduled
        </h3>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          <CalendarPlus size={12} />
          Add
        </button>
      </div>

      {upcoming.length === 0 ? (
        <button
          onClick={onAdd}
          className="w-full bg-slate-800/30 border border-dashed border-slate-700/60 rounded-xl py-5 text-center hover:border-violet-500/30 hover:bg-slate-800/50 transition-all group"
        >
          <CalendarPlus size={16} className="mx-auto mb-1.5 text-slate-600 group-hover:text-violet-500 transition-colors" />
          <p className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors">Schedule a practice session</p>
        </button>
      ) : (
        <div className="space-y-2">
          {upcoming.map((s) => (
            <div key={s.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{s.interviewLabel}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Calendar size={11} className="text-violet-400 flex-shrink-0" />
                    <p className="text-xs text-violet-400">{formatScheduledDate(s.scheduledAt)}</p>
                  </div>
                </div>
                <button
                  onClick={() => onDelete(s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-red-400 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <button
                onClick={() => onStart(s.interviewType)}
                className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-violet-600/10 hover:bg-violet-600 border border-violet-500/20 hover:border-violet-500 text-violet-400 hover:text-white text-xs font-semibold transition-all"
              >
                <Play size={11} />
                Begin Now
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { user } = useRequireAuth();
  const [selectedType, setSelectedType] = useState<InterviewCardConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledInterview[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false); // mobile drawer

  // Derive display name from Supabase user (OAuth provides full_name)
  const lastName = getUserDisplayName(user).split(' ')[0] || '';

  useEffect(() => {
    try {
      setSessions(JSON.parse(localStorage.getItem('intervyu_sessions') || '[]'));
    } catch { setSessions([]); }
    try {
      const all = JSON.parse(localStorage.getItem('intervyu_scheduled') || '[]');
      setScheduled(all.filter((s: ScheduledInterview) =>
        new Date(s.scheduledAt).getTime() > Date.now()
      ));
    } catch { setScheduled([]); }
  }, []);

  const filteredTypes = interviewTypes
    .filter((t) => activeFilter === 'All' || t.category === activeFilter)
    .filter((t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.company.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleCardStart = (id: string) => {
    const type = interviewTypes.find((t) => t.id === id);
    if (type) setSelectedType(type);
  };

  const handleDeleteScheduled = (id: string) => {
    const updated = scheduled.filter((s) => s.id !== id);
    setScheduled(updated);
    try {
      const all = JSON.parse(localStorage.getItem('intervyu_scheduled') || '[]');
      localStorage.setItem('intervyu_scheduled', JSON.stringify(all.filter((s: ScheduledInterview) => s.id !== id)));
    } catch { /* ignore */ }
  };

  const thisWeekCount = sessions.filter(s => {
    const diff = (Date.now() - new Date(s.date).getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).length;

  const LeftPanel = (
    <div className="flex flex-col overflow-y-auto h-full">
      <div className="p-5 lg:p-6 space-y-6">
        {/* Greeting */}
        <div>
          <p className="text-slate-400 text-sm">{getGreeting()}{lastName ? ',' : ''}</p>
          <h2 className="text-2xl font-bold text-white leading-tight">
            {lastName || 'Welcome back'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">Track your progress and start a new interview.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatsCard label="Total interviews" value={sessions.length} icon={<Video size={16} />} accent="violet" />
          <StatsCard label="This week" value={thisWeekCount} icon={<BarChart2 size={16} />} accent="emerald" />
        </div>

        {/* Scheduled */}
        <ScheduledSection
          scheduled={scheduled}
          onStart={handleCardStart}
          onDelete={handleDeleteScheduled}
          onAdd={() => setShowScheduleModal(true)}
        />

        {/* Past Interviews */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Past Interviews</h3>
            <Link href="/history" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
              View all →
            </Link>
          </div>
          <PastInterviewsList />
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      {/* Mobile: left panel drawer overlay */}
      {leftPanelOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setLeftPanelOpen(false)} />
          <div className="absolute left-16 top-0 bottom-0 w-80 bg-slate-950 border-r border-slate-800 z-50 overflow-y-auto">
            {LeftPanel}
          </div>
        </div>
      )}

      {/* Desktop: left panel — hidden on mobile, visible lg+ */}
      <div className="hidden lg:flex lg:w-[340px] xl:w-[380px] flex-shrink-0 border-r border-slate-800 flex-col overflow-hidden h-full">
        {LeftPanel}
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Right panel header */}
        <div className="relative px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-800 flex-shrink-0 overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute -top-10 right-0 w-64 h-40 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -top-6 right-20 w-32 h-24 bg-indigo-600/8 rounded-full blur-2xl pointer-events-none" />

          <div className="relative flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-3">
              {/* Mobile: menu to open left panel */}
              <button
                onClick={() => setLeftPanelOpen(true)}
                className="lg:hidden p-2 mt-0.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
              >
                <Menu size={18} />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-black leading-tight tracking-tight">
                  <span className="text-white">Mock Interviews for </span>
                  <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
                    Every Role
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-1 hidden sm:block">
                  Practice with AI · Get real-time feedback · Land your dream job
                </p>
              </div>
            </div>
          </div>

          {/* Search + Filters */}
          <div className="relative space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search company or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeFilter === f
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cards grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-600">
              <Search size={24} className="mb-2" />
              <p className="text-sm">No interviews match your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {filteredTypes.map((type) => (
                <InterviewCard key={type.id} {...type} onStart={handleCardStart} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <StartInterviewModal interviewType={selectedType} onClose={() => setSelectedType(null)} />
      <ScheduleModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onScheduled={() => {
          try {
            const all = JSON.parse(localStorage.getItem('intervyu_scheduled') || '[]');
            setScheduled(all.filter((s: ScheduledInterview) => new Date(s.scheduledAt).getTime() > Date.now()));
          } catch { /* ignore */ }
        }}
      />
    </DashboardLayout>
  );
}
