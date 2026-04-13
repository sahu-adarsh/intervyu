export type CheckerID =
  | 'quantification'
  | 'bullet_length'
  | 'bullet_improver'
  | 'verb_tense'
  | 'weak_verb'
  | 'section_checker'
  | 'skill_checker'
  | 'repetition'
  | 'spelling';

export interface CorrectionItem {
  text: string;
  issue: string;
  suggestion?: string;
}

export interface CheckerResult {
  id: CheckerID;
  label: string;
  description: string;
  needsFix: CorrectionItem[];
  good: CorrectionItem[];
  score: number;
}

export interface CVCorrections {
  checkers: CheckerResult[];
  generatedAt: string;
}

export interface CVAnalysis {
  candidateName?: string;
  email?: string;
  phone?: string;
  summary?: string;
  totalYearsExperience?: number;
  skills?: string[];
  technologies?: string[];
  experience?: Array<{ duration: string; company?: string; role?: string; context: string }>;
  education?: Array<{ degree: string; institution?: string; year?: string; context: string }>;
  categorized_skills?: Record<string, string[]>;
  industry?: string;
  file_type?: string;
}

// ATS engine re-exports — allows cv-reviewer components to co-locate their type imports
export type { ScoreResult, ScoreBreakdown, Suggestion, StructuredSuggestion } from '@/lib/ats-engine';
export type { ScoreResult as ATSScoreResult } from '@/lib/ats-engine';
