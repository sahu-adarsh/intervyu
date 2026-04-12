'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutGrid, FileText, AlertCircle, Send, X, LogOut, ChevronDown, Github } from 'lucide-react';
import { useSupabaseSession, signOut, getUserDisplayName, getUserAvatarUrl } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabase/client';

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

function GitHubStarButton() {
  return (
    <a
      href="https://github.com/sahu-adarsh/intervyu"
      target="_blank"
      rel="noopener noreferrer"
      className="group relative w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-yellow-400 hover:bg-slate-800 transition-colors"
    >
      <Github size={18} />
      <span className="absolute left-12 top-1/2 -translate-y-1/2 bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
        Star on GitHub
      </span>
    </a>
  );
}

function ReportIssueButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click-outside or Escape
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    if (open) {
      document.addEventListener('mousedown', onMouse);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Auto-close after sent
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => {
      setOpen(false);
      setSent(false);
      setMessage('');
      setCategory('');
    }, 2000);
    return () => clearTimeout(t);
  }, [sent]);

  async function handleSend() {
    if (!message.trim()) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('feedback').insert({
        user_id: session?.user.id ?? null,
        category: category || null,
        message: message.trim(),
        page: typeof window !== 'undefined' ? window.location.pathname : null,
      });
      setSent(true);
    } catch {
      // silent fail — still show success to user
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

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
        <div className="absolute left-14 bottom-0 w-[300px] bg-[#141420] border border-white/[0.08] rounded-2xl p-5 shadow-2xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-semibold text-slate-200">Report an Issue</p>
            <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-400 transition-colors">
              <X size={14} />
            </button>
          </div>

          {sent ? (
            /* Success state */
            <div className="flex flex-col items-center py-3 gap-2">
              <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2,8 6,12 14,4" />
                </svg>
              </div>
              <p className="text-[13px] font-medium text-slate-200">Thanks for the report!</p>
              <p className="text-[11px] text-slate-500">We'll look into it shortly.</p>
            </div>
          ) : (
            <>
              {/* Category dropdown */}
              <div className="relative mb-3">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 pr-8 text-[12px] text-slate-300 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition cursor-pointer"
                >
                  <option value="">Select category</option>
                  <option value="audio">Audio / Microphone</option>
                  <option value="interview">Interview Quality</option>
                  <option value="ui">UI / Display</option>
                  <option value="other">Other</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>

              {/* Textarea */}
              <div className="relative mb-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe the issue in detail"
                  maxLength={300}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[12px] text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition min-h-[96px]"
                />
                <span className="absolute bottom-2.5 right-3 text-[10px] text-slate-600 pointer-events-none">
                  {message.length}/300
                </span>
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={loading || !message.trim()}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' }}
              >
                {loading
                  ? <span className="w-3.5 h-3.5 border-[1.5px] border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Send size={12} /><span>Send</span></>}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function UserAvatar() {
  const router = useRouter();
  const { user } = useSupabaseSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const avatarUrl = getUserAvatarUrl(user);
  const displayName = getUserDisplayName(user);
  const initials = displayName ? displayName.trim()[0]?.toUpperCase() : '';

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="w-9 h-9 rounded-full overflow-hidden border-2 border-slate-700 hover:border-violet-500 transition-colors"
        title={displayName || 'Account'}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            {initials ? (
              <span className="text-white text-sm font-bold">{initials}</span>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-slate-300" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            )}
          </div>
        )}
      </button>

      {menuOpen && (
        <div className="absolute left-12 bottom-0 w-48 bg-slate-800 border border-slate-700 rounded-xl p-2 shadow-2xl z-50">
          {displayName && (
            <div className="px-3 py-2 border-b border-slate-700 mb-1">
              <p className="text-xs font-semibold text-slate-200 truncate">{displayName}</p>
              {user?.email && <p className="text-xs text-slate-500 truncate">{user.email}</p>}
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const rawPathname = usePathname();
  const pathname = rawPathname.replace(/\/$/, '') || '/';

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
          href="/dashboard"
          active={pathname === '/dashboard'}
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
        <GitHubStarButton />
        <ReportIssueButton />
        <UserAvatar />
      </div>
    </aside>
  );
}
