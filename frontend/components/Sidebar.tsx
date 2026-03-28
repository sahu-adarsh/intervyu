'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutGrid, FileText, AlertCircle, Send, X } from 'lucide-react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
}

function NavItem({ icon, label, href, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
        active
          ? 'bg-violet-600 text-white'
          : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
      }`}
    >
      {icon}
      {/* Tooltip */}
      <span className="absolute left-12 top-1/2 -translate-y-1/2 bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
        {label}
      </span>
    </Link>
  );
}

function ReportIssueButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen(!open)}
        className="group relative w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
      >
        <AlertCircle size={18} />
        <span className="absolute left-12 top-1/2 -translate-y-1/2 bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
          Report an Issue
        </span>
      </button>

      {open && (
        <div className="absolute left-14 bottom-0 w-64 bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-2xl z-50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-200">Report an Issue</p>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
              <X size={13} />
            </button>
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 mb-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="">Select category</option>
            <option value="audio">Audio / Microphone</option>
            <option value="interview">Interview Quality</option>
            <option value="ui">UI / Display</option>
            <option value="other">Other</option>
          </select>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the issue in detail"
            rows={3}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500 mb-2"
          />

          <button
            onClick={() => {
              // Future: POST to backend
              setOpen(false);
              setMessage('');
              setCategory('');
            }}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Send size={12} />
            Send
          </button>
        </div>
      )}
    </div>
  );
}

function UserAvatar() {
  const [initials, setInitials] = useState('');

  useEffect(() => {
    const name = localStorage.getItem('intervyu_last_name') || '';
    if (name) {
      setInitials(name.trim()[0]?.toUpperCase() || '');
    }
  }, []);

  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center overflow-hidden border-2 border-slate-700">
      {initials ? (
        <span className="text-white text-sm font-bold">{initials}</span>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-slate-300" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      )}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-16 h-screen bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="mb-6">
        <img src="/logo-icon.svg" alt="intervyu" className="h-8 w-8" />
      </div>

      {/* Nav */}
      <nav className="flex flex-col items-center gap-2 flex-1">
        <NavItem
          icon={<LayoutGrid size={18} />}
          label="Interview"
          href="/"
          active={pathname === '/'}
        />
        <NavItem
          icon={<FileText size={18} />}
          label="Resume"
          href="/resume"
          active={pathname === '/resume'}
        />
      </nav>

      {/* Bottom */}
      <div className="flex flex-col items-center gap-3">
        <ReportIssueButton />
        <UserAvatar />
      </div>
    </aside>
  );
}
