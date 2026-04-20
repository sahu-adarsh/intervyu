/**
 * Client-side CV correction checkers.
 * 5 of 9 checkers run entirely in the browser (<100 ms).
 * Prefers structured ExtractedLine[] for accurate bullet extraction:
 *   - x-position indentation detection (bullets without explicit •)
 *   - section-aware filtering (only Experience / Projects sections)
 * Falls back to raw text string parsing, then to structured CVAnalysis.experience[].context.
 */

import type { CVAnalysis, CheckerResult, CVCorrections } from '@/components/cv-reviewer/types';
import type { ExtractedCV, ExtractedLine } from '@/lib/cv-extractor';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEAK_VERBS = new Set([
  'worked', 'work', 'works',
  'helped', 'help', 'helps',
  'assisted', 'assist', 'assists',
  'supported', 'support', 'supports',
  'participated', 'participate', 'participates',
  'involved', 'involve', 'involves',
  'contributed', 'contribute', 'contributes',
  'handled', 'handle', 'handles',
  'did', 'do', 'does',
  'made', 'make', 'makes',
  'used', 'use', 'uses',
  'tried', 'try', 'tries',
  'performed', 'perform', 'performs',
  'conducted', 'conduct', 'conducts',
  'provided', 'provide', 'provides',
  'maintained', 'maintain', 'maintains',
  'dealt', 'deal', 'deals',
  'responsible',
  'tasked',
  'assigned',
  'utilized', 'utilize', 'utilizes',
  'ensured', 'ensure', 'ensures',
]);

// ~80 most common resume misspellings
const COMMON_MISSPELLINGS: Record<string, string> = {
  recieve: 'receive',
  recieved: 'received',
  acheive: 'achieve',
  acheived: 'achieved',
  acheiving: 'achieving',
  accomodate: 'accommodate',
  accomodated: 'accommodated',
  managment: 'management',
  developement: 'development',
  implemenation: 'implementation',
  implementaion: 'implementation',
  implemention: 'implementation',
  maintainance: 'maintenance',
  maintenence: 'maintenance',
  occured: 'occurred',
  occuring: 'occurring',
  seperete: 'separate',
  seperate: 'separate',
  seperately: 'separately',
  untill: 'until',
  successfull: 'successful',
  successfuly: 'successfully',
  relevent: 'relevant',
  independant: 'independent',
  dependant: 'dependent',
  performence: 'performance',
  experiance: 'experience',
  experianced: 'experienced',
  knowlege: 'knowledge',
  knowlegde: 'knowledge',
  knwoledge: 'knowledge',
  collaberation: 'collaboration',
  collabaration: 'collaboration',
  colaboration: 'collaboration',
  enviroment: 'environment',
  enviorment: 'environment',
  acheivement: 'achievement',
  acheivements: 'achievements',
  calender: 'calendar',
  definately: 'definitely',
  definatly: 'definitely',
  neccessary: 'necessary',
  necesary: 'necessary',
  proffesional: 'professional',
  proffessional: 'professional',
  profesional: 'professional',
  programing: 'programming',
  optimisation: 'optimization',
  optimise: 'optimize',
  optimised: 'optimized',
  specialised: 'specialized',
  specialise: 'specialize',
  recognised: 'recognized',
  recognise: 'recognize',
  utilising: 'utilizing',
  utilised: 'utilized',
  organising: 'organizing',
  organised: 'organized',
  architechture: 'architecture',
  architeture: 'architecture',
  databse: 'database',
  databses: 'databases',
  intergration: 'integration',
  intergrate: 'integrate',
  intergrated: 'integrated',
  automted: 'automated',
  improvment: 'improvement',
  improvments: 'improvements',
  reqiurement: 'requirement',
  reqirements: 'requirements',
  scalibility: 'scalability',
  scalibilty: 'scalability',
  reliabilty: 'reliability',
  availibilty: 'availability',
  visibilty: 'visibility',
  flexibilty: 'flexibility',
  proficieny: 'proficiency',
  proficency: 'proficiency',
  communiation: 'communication',
  communicaiton: 'communication',
  stratagy: 'strategy',
  strategey: 'strategy',
  technolgy: 'technology',
  infrasturcture: 'infrastructure',
  infrastracture: 'infrastructure',
  desicion: 'decision',
  decison: 'decision',
  assesment: 'assessment',
  documentaion: 'documentation',
};

const CHECKER_ORDER: CheckerResult['id'][] = [
  'quantification',
  'bullet_length',
  'bullet_improver',
  'verb_tense',
  'weak_verb',
  'section_checker',
  'skill_checker',
  'repetition',
  'spelling',
];

const CLIENT_SIDE_IDS = new Set<CheckerResult['id']>([
  'bullet_length', 'weak_verb', 'verb_tense', 'repetition', 'spelling',
]);

// ─── Line classification patterns ─────────────────────────────────────────────

// Section-header patterns — used to track which section we're in
const SECTION_HEADERS = /^(work\s+experience|experience|education|skills|projects?|certifications?|awards?|publications?|summary|objective|profile|contact|references?|volunteer|activities|interests?|languages?|honors?)\s*$/i;

// Sections where bullets are meaningful for checkers
const BULLET_SECTIONS = /^(work\s+experience|experience|projects?)\s*$/i;

// Metadata lines: year ranges, locations, role titles without sentence structure.
// Narrowed from original ^\d{4} which incorrectly dropped lines like "2024: Built..."
const METADATA_LINE = /^\d{4}\s*[-–—]\s*(\d{4}|present|current|now|ongoing)|^(remote|bangalore|mumbai|delhi|hyderabad|pune|chennai|kolkata|london|new york|san francisco)|^[A-Z][a-z]+,\s+[A-Z]{2}$/i;

const BULLET_CHAR_RE = /^[•\-\*▸◦▪►‣·]\s*/;

// ─── Bullet extraction — structured lines (primary path) ─────────────────────

/**
 * Extract bullets from structured ExtractedLine[] produced by cv-extractor.ts.
 * Uses:
 *  1. Section tracking — only collects from Experience / Projects sections.
 *  2. x-position indentation — lines indented vs left margin are bullets
 *     even without an explicit bullet character.
 *  3. Explicit bullet char — isBulletChar flag set by cv-extractor.ts.
 *
 * Falls back to any explicit-bullet-char line if section-aware pass finds nothing
 * (handles CVs with no recognisable section headers).
 */
function extractBulletsFromLines(lines: ExtractedLine[]): string[] {
  if (lines.length === 0) return [];

  // Compute document left margin: min x of lines with enough text to matter
  const significant = lines.filter((l) => l.text.trim().length > 10);
  if (significant.length === 0) return [];
  const leftMargin = Math.min(...significant.map((l) => l.x));
  // Lines indented by more than 12px relative to left margin are likely bullets
  const INDENT_THRESHOLD = 12;

  const bullets: string[] = [];
  let inBulletSection = false;

  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;

    // Detect section header → update tracking
    if (SECTION_HEADERS.test(text)) {
      inBulletSection = BULLET_SECTIONS.test(text);
      continue;
    }

    if (!inBulletSection) continue;
    if (text.length < 15) continue;
    if (METADATA_LINE.test(text)) continue;

    const isIndented = line.x > leftMargin + INDENT_THRESHOLD;
    if (!line.isBulletChar && !isIndented) continue;

    // Strip leading bullet char
    const stripped = text.replace(BULLET_CHAR_RE, '').trim();
    // Require at least 4 words and starts with uppercase
    if (stripped.split(/\s+/).length >= 4 && /^[A-Z]/.test(stripped)) {
      bullets.push(stripped);
    }
  }

  // Fallback: no section headers found — collect any explicit-bullet-char line
  if (bullets.length === 0) {
    for (const line of lines) {
      const text = line.text.trim();
      if (!text || text.length < 15) continue;
      if (SECTION_HEADERS.test(text) || METADATA_LINE.test(text)) continue;
      if (!line.isBulletChar) continue;
      const stripped = text.replace(BULLET_CHAR_RE, '').trim();
      if (stripped.split(/\s+/).length >= 4 && /^[A-Z]/.test(stripped)) {
        bullets.push(stripped);
      }
    }
  }

  return bullets;
}

// ─── Bullet extraction — raw text string (fallback for past resumes) ──────────

/**
 * Extract bullets from a raw text string (used when structured lines are
 * unavailable, e.g. when re-opening a past resume that only has rawText in DB).
 */
function extractBulletsFromRawText(rawText: string): string[] {
  const lines = rawText.split('\n');
  const bullets: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const stripped = trimmed.replace(BULLET_CHAR_RE, '').trim();

    if (stripped.length < 15) continue;
    if (SECTION_HEADERS.test(stripped)) continue;
    if (METADATA_LINE.test(stripped)) continue;

    const hasBulletChar = BULLET_CHAR_RE.test(trimmed);
    const looksLikeBullet = hasBulletChar && /^[A-Z]/.test(stripped) && stripped.split(/\s+/).length >= 4;

    if (looksLikeBullet) {
      bullets.push(stripped);
    }
  }

  return bullets;
}

/**
 * Fallback: extract bullets from structured experience[].context.
 * Less accurate but works when neither raw text nor lines are available.
 */
function extractBulletsFromAnalysis(analysis: CVAnalysis): string[] {
  const bullets: string[] = [];
  for (const exp of analysis.experience ?? []) {
    if (!exp.context) continue;
    const parts = exp.context
      .split(/(?<=\.)\s+(?=[A-Z])|[\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 15 && /^[A-Z]/.test(s));
    bullets.push(...parts);
  }
  return bullets;
}

function extractBullets(analysis: CVAnalysis, extracted?: ExtractedCV): string[] {
  // Primary: structured lines with positional metadata
  if (extracted?.lines && extracted.lines.length > 0) {
    const fromLines = extractBulletsFromLines(extracted.lines);
    if (fromLines.length >= 2) return fromLines;
  }
  // Secondary: raw text string (past resumes loaded from DB)
  if (extracted?.rawText && extracted.rawText.trim().length > 100) {
    const fromRaw = extractBulletsFromRawText(extracted.rawText);
    if (fromRaw.length >= 2) return fromRaw;
  }
  // Last resort: structured analysis
  return extractBulletsFromAnalysis(analysis);
}

// ─── Individual checkers ──────────────────────────────────────────────────────

function checkBulletLength(bullets: string[]): CheckerResult {
  const needsFix: CheckerResult['needsFix'] = [];
  const good: CheckerResult['good'] = [];

  for (const bullet of bullets) {
    const words = bullet.split(/\s+/).filter(Boolean);
    const count = words.length;
    if (count < 5) {
      needsFix.push({
        text: bullet,
        issue: `Too short — ${count} word${count !== 1 ? 's' : ''}`,
        suggestion: 'Expand with context, tools used, or a measurable outcome. Aim for 8–20 words.',
      });
    } else if (count > 25) {
      needsFix.push({
        text: bullet,
        issue: `Too long — ${count} words`,
        suggestion: 'Split into two bullets or trim filler phrases. Aim for 8–20 words per bullet.',
      });
    } else {
      good.push({ text: bullet, issue: '' });
    }
  }

  const total = bullets.length || 1;
  return {
    id: 'bullet_length',
    label: 'Bullet Point Length',
    description: 'Bullets that are too long (>25 words) or too short (<5 words)',
    needsFix,
    good,
    score: Math.round((good.length / total) * 100),
  };
}

function checkWeakVerbs(bullets: string[]): CheckerResult {
  const needsFix: CheckerResult['needsFix'] = [];
  const good: CheckerResult['good'] = [];

  for (const bullet of bullets) {
    const firstWord = bullet.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
    if (!firstWord) continue;
    if (WEAK_VERBS.has(firstWord)) {
      needsFix.push({
        text: bullet,
        issue: `Weak opening verb: "${firstWord}"`,
        suggestion: 'Replace with a strong action verb: Led, Built, Designed, Delivered, Optimized, etc.',
      });
    } else {
      good.push({ text: bullet, issue: '' });
    }
  }

  const total = bullets.length || 1;
  return {
    id: 'weak_verb',
    label: 'Weak Verb Checker',
    description: "Bullets starting with weak verbs like 'Worked', 'Helped', 'Assisted', 'Used'",
    needsFix,
    good,
    score: Math.round((good.length / total) * 100),
  };
}

function checkVerbTense(analysis: CVAnalysis, rawText?: string): CheckerResult {
  const needsFix: CheckerResult['needsFix'] = [];
  const good: CheckerResult['good'] = [];

  const isCurrent = (duration: string) =>
    /present|current|now|ongoing/i.test(duration);

  const IRREGULAR_PAST = new Set([
    'led', 'built', 'drove', 'grew', 'ran', 'wrote', 'made', 'held', 'kept',
    'sent', 'set', 'won', 'cut', 'hit', 'left', 'met', 'paid', 'sold', 'told',
    'took', 'gave', 'got', 'put', 'brought', 'caught', 'found', 'lost',
    'read', 'sat', 'saw', 'said', 'stood', 'taught', 'thought', 'understood',
  ]);

  const isPastTense = (verb: string) =>
    verb.endsWith('ed') || IRREGULAR_PAST.has(verb);

  // Past tense is correct for ALL bullet points (current and past roles alike).
  // Each bullet describes a completed action or achievement, even in an active job.
  // Only flag verbs that look like present-tense in a past role, where past tense
  // is strictly required.
  for (const exp of analysis.experience ?? []) {
    if (!exp.context && !rawText) continue;
    const current = isCurrent(exp.duration ?? '');

    // When rawText is available, bullets span the entire CV — only use rawText
    // for past roles to avoid incorrectly attributing cross-role bullets.
    let bullets: string[];
    if (!current && rawText && rawText.length > 100) {
      bullets = extractBulletsFromRawText(rawText);
    } else {
      bullets = (exp.context ?? '')
        .split(/(?<=\.)\s+(?=[A-Z])|[\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 15 && /^[A-Z]/.test(s));
    }

    for (const bullet of bullets) {
      const firstWord = bullet.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
      if (!firstWord || firstWord.length < 3) continue;

      const past = isPastTense(firstWord);

      if (!current && !past) {
        const looksLikePresentVerb = /(?:ize|ise|ate|ect|ign|ure|ive|ish|age|uce|ove|ule|ail|ain|eal|ess)s?$/.test(firstWord);
        if (looksLikePresentVerb) {
          needsFix.push({
            text: bullet,
            issue: 'Present tense used for past role — use past tense',
            suggestion: `Change "${firstWord}" to past tense.`,
          });
        } else {
          good.push({ text: bullet, issue: '' });
        }
      } else {
        good.push({ text: bullet, issue: '' });
      }
    }
    if (!current && rawText && rawText.length > 100) break;
  }

  const total = (needsFix.length + good.length) || 1;
  return {
    id: 'verb_tense',
    label: 'Verb Tense Checker',
    description: 'Past roles must use past tense; current role must use present tense',
    needsFix,
    good,
    score: Math.round((good.length / total) * 100),
  };
}

function checkRepetition(bullets: string[]): CheckerResult {
  const needsFix: CheckerResult['needsFix'] = [];
  const good: CheckerResult['good'] = [];

  const verbFreq: Map<string, number> = new Map();
  for (const bullet of bullets) {
    const verb = bullet.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
    if (verb.length >= 3) verbFreq.set(verb, (verbFreq.get(verb) ?? 0) + 1);
  }

  for (const bullet of bullets) {
    const verb = bullet.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
    const freq = verbFreq.get(verb) ?? 0;
    if (freq >= 3) {
      needsFix.push({
        text: bullet,
        issue: `Opening verb "${verb}" used ${freq} times`,
        suggestion: `Vary your verbs — replace some "${verb}" occurrences with synonyms.`,
      });
    } else {
      good.push({ text: bullet, issue: '' });
    }
  }

  const total = bullets.length || 1;
  return {
    id: 'repetition',
    label: 'Repetition',
    description: 'Overused opening verbs that make bullets sound monotonous',
    needsFix,
    good,
    score: Math.round((good.length / total) * 100),
  };
}

function checkSpelling(bullets: string[]): CheckerResult {
  const needsFix: CheckerResult['needsFix'] = [];
  const good: CheckerResult['good'] = [];

  for (const bullet of bullets) {
    const words = bullet.split(/\s+/);
    const issues: string[] = [];
    for (const word of words) {
      const clean = word.toLowerCase().replace(/[^a-z]/g, '');
      if (COMMON_MISSPELLINGS[clean]) {
        issues.push(`"${clean}" → "${COMMON_MISSPELLINGS[clean]}"`);
      }
    }
    if (issues.length > 0) {
      needsFix.push({
        text: bullet,
        issue: `Possible misspelling: ${issues.join(', ')}`,
        suggestion: `Correct spelling: ${issues.join(', ')}.`,
      });
    } else {
      good.push({ text: bullet, issue: '' });
    }
  }

  const total = bullets.length || 1;
  return {
    id: 'spelling',
    label: 'Spelling',
    description: 'Common spelling mistakes found in resume bullet points',
    needsFix,
    good,
    score: Math.round((good.length / total) * 100),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run all 5 client-side checkers.
 * Pass extracted (from extractTextFromFile) for best accuracy:
 *   - New uploads: full ExtractedCV with lines[] → structural parsing
 *   - Past resumes: { rawText, lines: [] } → string-based fallback
 *   - No text available: falls back to structured CVAnalysis
 */
export function runClientCheckers(analysis: CVAnalysis, extracted?: ExtractedCV): CheckerResult[] {
  const bullets = extractBullets(analysis, extracted);
  if (bullets.length === 0) return [];

  return [
    checkBulletLength(bullets),
    checkWeakVerbs(bullets),
    checkVerbTense(analysis, extracted?.rawText),
    checkRepetition(bullets),
    checkSpelling(bullets),
  ];
}

/**
 * Merge client-side CheckerResults with AI-generated ones.
 * Client-side results take precedence for the 5 client checkers.
 * Returns null only if both inputs are empty.
 */
export function mergeCorrections(
  clientCheckers: CheckerResult[],
  aiCheckers: CheckerResult[],
): CVCorrections | null {
  if (clientCheckers.length === 0 && aiCheckers.length === 0) return null;

  const byId = new Map<string, CheckerResult>();

  for (const c of aiCheckers) byId.set(c.id, c);
  for (const c of clientCheckers) {
    if (CLIENT_SIDE_IDS.has(c.id)) byId.set(c.id, c);
  }

  const checkers = CHECKER_ORDER
    .map((id) => byId.get(id))
    .filter((c): c is CheckerResult => c !== undefined);

  return { checkers, generatedAt: new Date().toISOString() };
}
