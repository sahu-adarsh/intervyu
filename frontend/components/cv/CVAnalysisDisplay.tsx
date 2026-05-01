'use client';

import { useState } from 'react';
import {
  User, Mail, Phone, Briefcase, GraduationCap, Code,
  Edit2, Check, X, Target, Loader2, ChevronRight,
  TrendingUp, AlertCircle, CheckCircle, MinusCircle,
} from 'lucide-react';
import { triggerJdGapAnalysis, type JdGapReport, type JdGapSkillItem } from '@/lib/api';

interface CVAnalysis {
  candidateName: string;
  email: string;
  phone: string;
  skills: string[];
  experience: Array<{ duration: string; context: string }>;
  education: Array<{ degree: string; context: string }>;
  totalYearsExperience: number;
  technologies: string[];
  summary: string;
}

interface CVAnalysisDisplayProps {
  analysis: CVAnalysis;
  sessionId?: string;
  initialGapReport?: JdGapReport | null;
  onUpdate?: (updatedAnalysis: CVAnalysis) => void;
}

type Tab = 'overview' | 'job-match';

// ── small helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JdGapSkillItem['status'] }) {
  if (status === 'present') return (
    <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-medium">
      <CheckCircle className="w-3 h-3" /> Present
    </span>
  );
  if (status === 'partial') return (
    <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 font-medium">
      <MinusCircle className="w-3 h-3" /> Partial
    </span>
  );
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-medium">
      <X className="w-3 h-3" /> Missing
    </span>
  );
}

function SeniorityBanner({ fit, reason }: { fit: JdGapReport['seniority_fit']; reason: string }) {
  const config = {
    'good-fit': { bg: 'bg-green-50 border-green-200', text: 'text-green-800', label: 'Good seniority fit' },
    'under-qualified': { bg: 'bg-red-50 border-red-200', text: 'text-red-800', label: 'Under-qualified for this level' },
    'over-qualified': { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', label: 'Over-qualified for this level' },
  }[fit];

  return (
    <div className={`rounded-lg border px-4 py-3 ${config.bg}`}>
      <p className={`text-sm font-semibold ${config.text}`}>{config.label}</p>
      {reason && <p className={`text-sm mt-0.5 ${config.text} opacity-80`}>{reason}</p>}
    </div>
  );
}

function MatchScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? '#16a34a' : score >= 45 ? '#ca8a04' : '#dc2626';
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
        <text x="48" y="53" textAnchor="middle" fontSize="20" fontWeight="700" fill={color}>
          {score}
        </text>
      </svg>
      <span className="text-xs text-gray-500 font-medium">Match Score</span>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function CVAnalysisDisplay({
  analysis,
  sessionId,
  initialGapReport = null,
  onUpdate,
}: CVAnalysisDisplayProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState<CVAnalysis>(analysis);

  // Job Match state
  const [gapReport, setGapReport] = useState<JdGapReport | null>(initialGapReport);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const handleSave = () => { onUpdate?.(editedAnalysis); setIsEditing(false); };
  const handleCancel = () => { setEditedAnalysis(analysis); setIsEditing(false); };
  const updateSkills = (s: string) =>
    setEditedAnalysis({ ...editedAnalysis, skills: s.split(',').map(x => x.trim()).filter(Boolean) });

  const handleAnalyze = async () => {
    if (!sessionId || !jobTitle.trim() || !jobDescription.trim()) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await triggerJdGapAnalysis(sessionId, jobTitle.trim(), jobDescription.trim());
      setGapReport(res.gap_report);
    } catch (e) {
      setAnalyzeError('Analysis failed — please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b">
        <button
          onClick={() => setTab('overview')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
            tab === 'overview'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <User className="w-4 h-4" /> Overview
        </button>
        <button
          onClick={() => setTab('job-match')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
            tab === 'job-match'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Target className="w-4 h-4" />
          Job Match
          {gapReport && (
            <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold ${
              gapReport.match_score >= 70 ? 'bg-green-100 text-green-700' :
              gapReport.match_score >= 45 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {gapReport.match_score}
            </span>
          )}
        </button>
      </div>

      {/* ── Overview tab ───────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b">
            <h2 className="text-2xl font-bold text-gray-900">CV Analysis</h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Edit2 className="w-4 h-4" /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                  <Check className="w-4 h-4" /> Save
                </button>
                <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-gray-700 italic">"{editedAnalysis.summary}"</p>
          </div>

          {/* Personal Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: User, label: 'Name', field: 'candidateName' as const, type: 'text' },
              { icon: Mail, label: 'Email', field: 'email' as const, type: 'email' },
              { icon: Phone, label: 'Phone', field: 'phone' as const, type: 'tel' },
            ].map(({ icon: Icon, label, field, type }) => (
              <div key={field} className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <div className="min-w-0 w-full">
                  <p className="text-xs text-gray-500">{label}</p>
                  {isEditing ? (
                    <input
                      type={type}
                      value={editedAnalysis[field] ?? ''}
                      onChange={e => setEditedAnalysis({ ...editedAnalysis, [field]: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    <p className="font-medium text-gray-900 truncate">{editedAnalysis[field]}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Experience */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">
                Experience ({editedAnalysis.totalYearsExperience} years)
              </h3>
            </div>
            <div className="space-y-2">
              {(editedAnalysis.experience ?? []).map((exp, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900">{exp.duration}</p>
                  <p className="text-sm text-gray-600 mt-1">{exp.context}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Education */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">Education</h3>
            </div>
            <div className="space-y-2">
              {(editedAnalysis.education ?? []).map((edu, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900">{edu.degree}</p>
                  <p className="text-sm text-gray-600 mt-1">{edu.context}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Code className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">Skills & Technologies</h3>
            </div>
            {isEditing ? (
              <textarea
                value={editedAnalysis.skills.join(', ')}
                onChange={e => updateSkills(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                placeholder="Enter skills separated by commas"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(editedAnalysis.skills ?? []).map((skill, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Job Match tab ───────────────────────────────────────────────────── */}
      {tab === 'job-match' && (
        <div className="p-6 space-y-6">
          {!gapReport ? (
            /* Input form */
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Analyze Job Match</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Paste the job you're targeting — get a real gap report, not keyword counting.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Description</label>
                <textarea
                  value={jobDescription}
                  onChange={e => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={8}
                />
              </div>
              {analyzeError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {analyzeError}
                </p>
              )}
              <button
                onClick={handleAnalyze}
                disabled={analyzing || !jobTitle.trim() || !jobDescription.trim() || !sessionId}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                {analyzing ? 'Analyzing...' : 'Analyze Match'}
              </button>
            </div>
          ) : (
            /* Gap report display */
            <div className="space-y-6">
              {/* Score + seniority row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <MatchScoreRing score={gapReport.match_score} />
                <div className="flex-1 space-y-3">
                  <p className="text-sm text-gray-600">{gapReport.match_score_reason}</p>
                  <SeniorityBanner fit={gapReport.seniority_fit} reason={gapReport.seniority_reason} />
                </div>
              </div>

              {/* Strengths + Gaps row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" /> Top Strengths
                  </h3>
                  <ul className="space-y-1">
                    {gapReport.top_strengths.map((s, i) => (
                      <li key={i} className="text-sm text-green-700 flex gap-2">
                        <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Critical Gaps
                  </h3>
                  <ul className="space-y-1">
                    {gapReport.critical_gaps.map((g, i) => (
                      <li key={i} className="text-sm text-red-700 flex gap-2">
                        <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5" /> {g}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Required skills table */}
              {gapReport.required_skills.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Required Skills</h3>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <tr>
                          <th className="px-4 py-2 text-left">Skill</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-left hidden sm:table-cell">Evidence in your CV</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {gapReport.required_skills.map((item, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-900">{item.skill}</td>
                            <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
                            <td className="px-4 py-2.5 text-gray-500 italic text-xs hidden sm:table-cell">
                              {item.resume_evidence ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Preferred skills table */}
              {gapReport.preferred_skills.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Preferred / Nice-to-Have</h3>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <tr>
                          <th className="px-4 py-2 text-left">Skill</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-left hidden sm:table-cell">Evidence in your CV</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {gapReport.preferred_skills.map((item, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-900">{item.skill}</td>
                            <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
                            <td className="px-4 py-2.5 text-gray-500 italic text-xs hidden sm:table-cell">
                              {item.resume_evidence ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Transferable bridges */}
              {gapReport.transferable_bridges.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Transferable Experience</h3>
                  <div className="space-y-3">
                    {gapReport.transferable_bridges.map((b, i) => (
                      <div key={i} className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-2">
                          <span className="text-red-600 font-medium">JD requires: {b.jd_requires}</span>
                          <span className="text-gray-500">→</span>
                          <span className="text-blue-700 font-medium">You have: {b.candidate_has}</span>
                        </div>
                        <p className="text-sm text-blue-800">{b.bridge}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interview preparation */}
              {gapReport.interview_preparation.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">Interview Prep for Your Gaps</h3>
                  <p className="text-xs text-gray-500 mb-3">These questions will likely surface because of your gaps — here's how to frame your answers.</p>
                  <div className="space-y-4">
                    {gapReport.interview_preparation.map((p, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-800">Gap: {p.gap}</span>
                        </div>
                        <div className="px-4 py-3 space-y-2">
                          <div className="bg-gray-50 border-l-2 border-blue-400 pl-3 py-1 rounded-sm">
                            <p className="text-xs text-gray-500 mb-0.5">Expected question</p>
                            <p className="text-sm text-gray-700 italic">"{p.expected_question}"</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Bridge: {p.resume_bridge}</p>
                            <p className="text-sm text-gray-700">{p.framing_advice}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Re-analyze button */}
              <button
                onClick={() => setGapReport(null)}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Analyze a different role
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
