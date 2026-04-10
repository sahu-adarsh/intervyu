'use client';

import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, GraduationCap, Star, User, ChevronDown } from 'lucide-react';
import { CVAnalysis } from './types';

interface AtsScorePanelProps {
  atsScore: number;
  analysis: CVAnalysis;
  matchedKeywords?: string[];
  missingKeywords?: string[];
}

// ─── Animation hook ───────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(0);
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

// ─── Scoring engine ───────────────────────────────────────────────────────────
// Each category has named sub-metrics with defined max points.
// Scores are computed deterministically from parsed CV data — no LLM guesswork.

export interface SubMetric {
  label: string;
  value: number;   // 0–max
  max: number;
  note: string;    // short description of what was found
}

export interface CategoryScore {
  score: number;   // 0–100
  subs: SubMetric[];
}

export interface SubScores {
  hardSkills: CategoryScore;
  experience: CategoryScore;
  education: CategoryScore;
  profile: CategoryScore;
}

const SENIORITY_KEYWORDS = ['senior', 'lead', 'principal', 'staff', 'director', 'vp', 'head of', 'manager', 'architect'];
const IMPACT_PATTERNS = /\b(\d+[%x]|\d+\s*(users|customers|requests|ms|seconds|million|billion|k\b|times|hours|days|weeks))\b/i;
const DEGREE_LEVELS: Array<{ keywords: string[]; score: number; label: string }> = [
  { keywords: ['phd', 'ph.d', 'doctorate', 'doctor of'], score: 100, label: 'PhD' },
  { keywords: ['master', 'm.tech', 'm.s.', 'mba', 'msc', 'm.sc', 'me '], score: 80, label: 'Masters' },
  { keywords: ['bachelor', 'b.tech', 'b.e.', 'b.s.', 'bsc', 'b.sc', 'undergraduate', 'honours'], score: 60, label: 'Bachelors' },
  { keywords: ['diploma', 'associate', 'higher national'], score: 30, label: 'Diploma' },
];
const TECHNICAL_FIELDS = ['computer', 'software', 'information', 'data', 'engineering', 'electronics', 'mathematics', 'statistics', 'physics', 'cybersecurity', 'ai', 'machine learning'];
const MODERN_TECH = ['docker', 'kubernetes', 'aws', 'azure', 'gcp', 'react', 'nextjs', 'next.js', 'typescript', 'fastapi', 'graphql', 'terraform', 'ci/cd', 'llm', 'genai', 'bedrock', 'langchain', 'redis', 'kafka', 'spark'];

function computeSubScores(analysis: CVAnalysis): SubScores {
  const allSkills = [...new Set([...(analysis.skills ?? []), ...(analysis.technologies ?? [])])];
  const catSkills = analysis.categorized_skills ?? {};
  const experience = analysis.experience ?? [];
  const education = analysis.education ?? [];
  const years = analysis.totalYearsExperience ?? 0;

  // ── Hard Skills ─────────────────────────────────────────────────────────────
  // Sub 1 — Skill count (max 45): 1 pt/skill up to 30, then tapering
  const skillCountRaw = Math.min(45, allSkills.length <= 30
    ? allSkills.length * 1.5
    : 45 - (allSkills.length - 30) * 0.2);
  const skillCountScore = Math.round(skillCountRaw);

  // Sub 2 — Stack diversity (max 35): languages + frameworks + DBs + tools each = 8-9pts
  const catKeys = Object.keys(catSkills).filter(k => (catSkills[k]?.length ?? 0) > 0);
  const diversityScore = Math.min(35, catKeys.length * 9);

  // Sub 3 — Modern tech presence (max 20)
  const skillsLower = allSkills.map(s => s.toLowerCase());
  const modernCount = MODERN_TECH.filter(t => skillsLower.some(s => s.includes(t))).length;
  const modernScore = Math.min(20, modernCount * 5);

  const hardSkillsTotal = skillCountScore + diversityScore + modernScore;

  // ── Experience ──────────────────────────────────────────────────────────────
  // Sub 1 — Years (max 50): 0=0, 1=15, 2=25, 3=35, 5=43, 8=48, 10+=50
  const yearsScore = years === 0 ? 0
    : years < 1 ? 10
    : years < 2 ? 20
    : years < 3 ? 30
    : years < 5 ? 38
    : years < 8 ? 44
    : years < 10 ? 48
    : 50;

  // Sub 2 — Role count + seniority (max 30)
  const roleCountScore = Math.min(15, experience.length * 5);
  const contextAll = experience.map(e => `${e.role ?? ''} ${e.context ?? ''}`).join(' ').toLowerCase();
  const hasSeniority = SENIORITY_KEYWORDS.some(k => contextAll.includes(k));
  const seniorityScore = hasSeniority ? 15 : 0;

  // Sub 3 — Quantified impact (max 20)
  const impactMatches = experience.filter(e => IMPACT_PATTERNS.test(e.context ?? '')).length;
  const impactScore = Math.min(20, impactMatches * 7);

  const experienceTotal = yearsScore + roleCountScore + seniorityScore + impactScore;

  // ── Education ───────────────────────────────────────────────────────────────
  // Sub 1 — Highest degree level (max 60)
  const allEduText = education.map(e => `${e.degree ?? ''} ${e.context ?? ''} ${e.institution ?? ''}`).join(' ').toLowerCase();
  let degreeScore = 0;
  let degreeLabel = 'Not detected';
  for (const tier of DEGREE_LEVELS) {
    if (tier.keywords.some(k => allEduText.includes(k))) {
      degreeScore = tier.score * 0.6; // scale to max 60
      degreeLabel = tier.label;
      break;
    }
  }

  // Sub 2 — Field relevance (max 25)
  const isTechnical = TECHNICAL_FIELDS.some(f => allEduText.includes(f));
  const fieldScore = isTechnical ? 25 : (education.length > 0 ? 10 : 0);

  // Sub 3 — Additional credentials (max 15): extra entries beyond primary degree
  const extraCredScore = Math.min(15, Math.max(0, education.length - 1) * 8);

  const educationTotal = Math.round(degreeScore) + fieldScore + extraCredScore;

  // ── Profile ─────────────────────────────────────────────────────────────────
  // Sub 1 — Contact info (max 45): name=20, email=15, phone=10
  const nameScore = analysis.candidateName ? 20 : 0;
  const emailScore = analysis.email ? 15 : 0;
  const phoneScore = analysis.phone ? 10 : 0;

  // Sub 2 — Professional summary quality (max 35): present=15, length=10, specificity=10
  const summaryLen = (analysis.summary ?? '').trim().length;
  const summaryPresent = summaryLen > 0 ? 15 : 0;
  const summaryLength = summaryLen > 100 ? 10 : summaryLen > 50 ? 5 : 0;
  const summarySpecific = /\d+/.test(analysis.summary ?? '') ? 10 : 0; // has numbers = specific

  // Sub 3 — Online presence hints (max 20): GitHub/LinkedIn mentioned in any field
  const allText = JSON.stringify(analysis).toLowerCase();
  const hasGitHub = allText.includes('github') ? 10 : 0;
  const hasLinkedIn = allText.includes('linkedin') ? 10 : 0;

  const profileTotal = nameScore + emailScore + phoneScore + summaryPresent + summaryLength + summarySpecific + hasGitHub + hasLinkedIn;

  return {
    hardSkills: {
      score: Math.min(100, hardSkillsTotal),
      subs: [
        { label: 'Skill count', value: skillCountScore, max: 45, note: `${allSkills.length} unique skills` },
        { label: 'Stack diversity', value: diversityScore, max: 35, note: catKeys.length > 0 ? catKeys.join(', ') : 'No categories detected' },
        { label: 'Modern tech', value: modernScore, max: 20, note: modernCount > 0 ? `${modernCount} modern tools` : 'No modern stack detected' },
      ],
    },
    experience: {
      score: Math.min(100, experienceTotal),
      subs: [
        { label: 'Years of experience', value: yearsScore, max: 50, note: years > 0 ? `${years} years` : 'Not detected' },
        { label: 'Role count + seniority', value: roleCountScore + seniorityScore, max: 30, note: `${experience.length} role${experience.length !== 1 ? 's' : ''}${hasSeniority ? ' · Senior title detected' : ''}` },
        { label: 'Quantified impact', value: impactScore, max: 20, note: impactMatches > 0 ? `${impactMatches} role${impactMatches !== 1 ? 's' : ''} with metrics` : 'No numbers/metrics found' },
      ],
    },
    education: {
      score: Math.min(100, educationTotal),
      subs: [
        { label: 'Degree level', value: Math.round(degreeScore), max: 60, note: degreeLabel },
        { label: 'Field relevance', value: fieldScore, max: 25, note: isTechnical ? 'Technical field' : (education.length > 0 ? 'Non-technical field' : 'No education found') },
        { label: 'Extra credentials', value: extraCredScore, max: 15, note: education.length > 1 ? `${education.length - 1} additional entr${education.length > 2 ? 'ies' : 'y'}` : 'None' },
      ],
    },
    profile: {
      score: Math.min(100, profileTotal),
      subs: [
        { label: 'Contact info', value: nameScore + emailScore + phoneScore, max: 45, note: [analysis.candidateName && 'name', analysis.email && 'email', analysis.phone && 'phone'].filter(Boolean).join(', ') || 'Missing' },
        { label: 'Summary quality', value: summaryPresent + summaryLength + summarySpecific, max: 35, note: summaryLen > 0 ? `${summaryLen} chars${summarySpecific ? ' · has metrics' : ''}` : 'No summary' },
        { label: 'Online presence', value: hasGitHub + hasLinkedIn, max: 20, note: [hasGitHub && 'GitHub', hasLinkedIn && 'LinkedIn'].filter(Boolean).join(', ') || 'Not detected' },
      ],
    },
  };
}

function getScoreLabel(score: number) {
  if (score >= 85) return { label: 'Excellent', color: 'text-emerald-400' };
  if (score >= 70) return { label: 'Strong', color: 'text-violet-400' };
  if (score >= 55) return { label: 'Good', color: 'text-blue-400' };
  if (score >= 40) return { label: 'Fair', color: 'text-amber-400' };
  return { label: 'Needs Work', color: 'text-red-400' };
}

function getScoreAdvice(scores: SubScores): string {
  const weakest = Object.entries({
    'Hard Skills': scores.hardSkills.score,
    'Experience': scores.experience.score,
    'Education': scores.education.score,
    'Profile': scores.profile.score,
  }).sort((a, b) => a[1] - b[1]);

  const tips: string[] = [];
  const [worstKey, worstScore] = weakest[0];

  if (worstKey === 'Hard Skills' && worstScore < 70) {
    const hasDiversity = scores.hardSkills.subs[1].value < 20;
    tips.push(hasDiversity ? 'Add skills across languages, frameworks, databases, and tools.' : 'List more specific technologies and modern stack tools.');
  } else if (worstKey === 'Experience' && worstScore < 70) {
    const noImpact = scores.experience.subs[2].value === 0;
    tips.push(noImpact ? 'Add quantified achievements (e.g. "reduced latency by 40%").' : 'Highlight senior-level contributions or expand role descriptions.');
  } else if (worstKey === 'Education' && worstScore < 60) {
    tips.push('Add certifications, online courses, or clarify your degree field.');
  } else if (worstKey === 'Profile' && worstScore < 70) {
    const noOnline = scores.profile.subs[2].value === 0;
    tips.push(noOnline ? 'Add your GitHub and LinkedIn to boost discoverability.' : 'Complete your contact details and write a stronger summary.');
  }

  if (tips.length === 0) return 'Well-structured resume. Tailor keywords to each job description for best ATS match.';
  return tips[0];
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const displayed = useCountUp(score);
  const { label, color } = getScoreLabel(score);
  const gradId = `score-grad-${score}`;
  const isStrong = score >= 70;
  const isFair = score >= 50;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 124 124">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isStrong ? '#8b5cf6' : isFair ? '#f59e0b' : '#f87171'} />
              <stop offset="100%" stopColor={isStrong ? '#6366f1' : isFair ? '#d97706' : '#ef4444'} />
            </linearGradient>
          </defs>
          <circle cx="62" cy="62" r={r} fill="none" stroke="#1e293b" strokeWidth="11" />
          <circle cx="62" cy="62" r={r} fill="none"
            stroke={`url(#${gradId})`} strokeWidth="11"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" opacity="0.2"
            style={{ filter: 'blur(4px)', transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
          <circle cx="62" cy="62" r={r} fill="none"
            stroke={`url(#${gradId})`} strokeWidth="11"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white leading-none tabular-nums">{displayed}</span>
          <span className="text-xs text-slate-500 mt-0.5">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-bold tracking-wide ${color}`}>{label}</span>
    </div>
  );
}

// ─── Metric Card with expandable sub-metrics ──────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  category: CategoryScore;
  accentColor: string;
  bgColor: string;
  iconBg: string;
}

function MetricCard({ icon, label, category, accentColor, bgColor, iconBg }: MetricCardProps) {
  const [expanded, setExpanded] = useState(false);
  const displayed = useCountUp(category.score, 900);

  return (
    <div className={`rounded-xl border border-white/5 ${bgColor} overflow-hidden`}>
      <button
        className="w-full flex items-center gap-2.5 p-2.5 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-500 leading-none mb-0.5">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-slate-200 tabular-nums">{displayed}</span>
            <span className="text-[10px] text-slate-500">%</span>
          </div>
          <div className="h-0.5 w-full bg-slate-700/60 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${displayed}%`, background: accentColor }}
            />
          </div>
        </div>
        <ChevronDown
          size={12}
          className={`text-slate-600 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-white/5 pt-2">
          {category.subs.map((sub) => {
            const pct = Math.round((sub.value / sub.max) * 100);
            return (
              <div key={sub.label}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-slate-500">{sub.label}</span>
                  <span className="text-[10px] text-slate-400 tabular-nums">{sub.value}/{sub.max}</span>
                </div>
                <div className="h-1 w-full bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: accentColor, opacity: 0.7 }}
                  />
                </div>
                <p className="text-[9px] text-slate-600 mt-0.5 truncate">{sub.note}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Profile Snapshot (replaces generic Claude summary) ──────────────────────

function ProfileSnapshot({ analysis }: { analysis: CVAnalysis }) {
  const allSkills = [...new Set([...(analysis.skills ?? []), ...(analysis.technologies ?? [])])];
  const years = analysis.totalYearsExperience ?? 0;
  const roles = analysis.experience ?? [];
  const edu = analysis.education ?? [];

  const rows: Array<{ icon: string; text: string }> = [];

  if (analysis.candidateName || analysis.email) {
    const parts = [analysis.candidateName, analysis.email, analysis.phone].filter(Boolean);
    rows.push({ icon: '👤', text: parts.join(' · ') });
  }
  if (years > 0 || roles.length > 0) {
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} yr${years !== 1 ? 's' : ''} experience`);
    if (roles.length > 0) parts.push(`${roles.length} role${roles.length !== 1 ? 's' : ''}`);
    const latestRole = roles[0];
    if (latestRole?.role && latestRole?.company) parts.push(`Latest: ${latestRole.role} @ ${latestRole.company}`);
    else if (latestRole?.role) parts.push(`Latest: ${latestRole.role}`);
    rows.push({ icon: '💼', text: parts.join(' · ') });
  }
  if (edu.length > 0) {
    const primary = edu[0];
    const parts = [primary.degree, primary.institution, primary.year].filter(Boolean);
    rows.push({ icon: '🎓', text: parts.join(' · ') });
  }
  if (allSkills.length > 0) {
    const preview = allSkills.slice(0, 4).join(', ');
    const extra = allSkills.length > 4 ? ` +${allSkills.length - 4} more` : '';
    rows.push({ icon: '⚡', text: `${allSkills.length} skills · ${preview}${extra}` });
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Profile Snapshot</p>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-sm leading-tight flex-shrink-0">{row.icon}</span>
            <span className="text-xs text-slate-300 leading-relaxed">{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function AtsScorePanel({ atsScore, analysis, matchedKeywords = [], missingKeywords = [] }: AtsScorePanelProps) {
  const sub = computeSubScores(analysis);
  const advice = getScoreAdvice(sub);

  return (
    <div className="space-y-3">
      {/* Hero Score Card */}
      <div className="rounded-2xl overflow-hidden border border-slate-700/50"
        style={{ background: 'linear-gradient(135deg, rgb(15,23,42) 0%, rgb(23,30,51) 50%, rgb(15,23,42) 100%)' }}>
        <div className="p-4">
          <div className="flex items-start gap-4">
            <ScoreRing score={atsScore} />
            <div className="flex-1 grid grid-cols-2 gap-2">
              <MetricCard
                icon={<Star size={13} className="text-blue-300" />}
                label="Hard Skills" category={sub.hardSkills}
                accentColor="#93c5fd" iconBg="bg-blue-500/15 text-blue-300" bgColor="bg-slate-800/60"
              />
              <MetricCard
                icon={<TrendingUp size={13} className="text-violet-300" />}
                label="Experience" category={sub.experience}
                accentColor="#c4b5fd" iconBg="bg-violet-500/15 text-violet-300" bgColor="bg-slate-800/60"
              />
              <MetricCard
                icon={<GraduationCap size={13} className="text-emerald-300" />}
                label="Education" category={sub.education}
                accentColor="#6ee7b7" iconBg="bg-emerald-500/15 text-emerald-300" bgColor="bg-slate-800/60"
              />
              <MetricCard
                icon={<User size={13} className="text-amber-300" />}
                label="Profile" category={sub.profile}
                accentColor="#fcd34d" iconBg="bg-amber-500/15 text-amber-300" bgColor="bg-slate-800/60"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mt-3 pt-3 border-t border-slate-700/50">
            {advice}
          </p>
        </div>
      </div>

      {/* Profile Snapshot */}
      <ProfileSnapshot analysis={analysis} />

      {/* Keywords */}
      {(matchedKeywords.length > 0 || missingKeywords.length > 0) && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
          {matchedKeywords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Matched Keywords ({matchedKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {matchedKeywords.slice(0, 10).map((k) => (
                  <span key={k} className="px-2 py-0.5 rounded-md bg-emerald-900/30 border border-emerald-800/50 text-emerald-300 text-xs">{k}</span>
                ))}
              </div>
            </div>
          )}
          {missingKeywords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                Missing Keywords ({missingKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missingKeywords.slice(0, 10).map((k) => (
                  <span key={k} className="px-2 py-0.5 rounded-md bg-amber-900/30 border border-amber-800/50 text-amber-300 text-xs">{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
