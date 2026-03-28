'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock } from 'lucide-react';

const interviewTypeOptions = [
  { id: 'google-sde',    label: 'Google SDE Technical Interview' },
  { id: 'amazon-sde',   label: 'Amazon SDE Interview' },
  { id: 'microsoft-sde',label: 'Microsoft SDE Interview' },
  { id: 'aws-sa',       label: 'AWS Solutions Architect' },
  { id: 'azure-sa',     label: 'Azure Solutions Architect' },
  { id: 'gcp-sa',       label: 'GCP Solutions Architect' },
  { id: 'behavioral',   label: 'CV Grilling' },
  { id: 'coding-round', label: 'Coding Round' },
];

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

export interface ScheduledInterview {
  id: string;
  interviewType: string;
  interviewLabel: string;
  scheduledAt: string; // ISO
  candidateName: string;
}

export default function ScheduleModal({ open, onClose, onScheduled }: ScheduleModalProps) {
  const [interviewType, setInterviewType] = useState('google-sde');
  const [dateTime, setDateTime] = useState('');
  const [saving, setSaving] = useState(false);

  // Default to tomorrow at 10am
  useEffect(() => {
    if (open) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      setDateTime(tomorrow.toISOString().slice(0, 16));
    }
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSave = () => {
    if (!dateTime) return;
    setSaving(true);

    const label = interviewTypeOptions.find(o => o.id === interviewType)?.label || interviewType;
    const candidateName = localStorage.getItem('intervyu_last_name') || '';

    const scheduled: ScheduledInterview = {
      id: Date.now().toString(),
      interviewType,
      interviewLabel: label,
      scheduledAt: new Date(dateTime).toISOString(),
      candidateName,
    };

    try {
      const existing = JSON.parse(localStorage.getItem('intervyu_scheduled') || '[]');
      existing.push(scheduled);
      // Sort by scheduledAt ascending
      existing.sort((a: ScheduledInterview, b: ScheduledInterview) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
      localStorage.setItem('intervyu_scheduled', JSON.stringify(existing));
    } catch {
      // ignore
    }

    setSaving(false);
    onScheduled();
    onClose();
  };

  if (!open) return null;

  const minDateTime = new Date().toISOString().slice(0, 16);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-white">Schedule Interview</h2>
            <p className="text-xs text-slate-500 mt-0.5">Set a reminder for your next practice session</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Interview type */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-2">
            Interview Type
          </label>
          <select
            value={interviewType}
            onChange={(e) => setInterviewType(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent appearance-none cursor-pointer"
          >
            {interviewTypeOptions.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Date & time */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-2">
            Date & Time
          </label>
          <div className="relative">
            <input
              type="datetime-local"
              value={dateTime}
              min={minDateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5 mb-5">
          <Clock size={13} className="text-violet-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-400 leading-relaxed">
            This will appear in your scheduled interviews. Start it anytime by clicking <strong className="text-slate-200">Begin Now</strong>.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={!dateTime || saving}
          className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Calendar size={14} />
          Schedule Interview
        </button>
      </div>
    </div>
  );
}
