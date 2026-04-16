/**
 * Client-side CV correction checkers.
 * 5 of 9 checkers run entirely in the browser (<100 ms) using structured CVAnalysis.
 * The 4 AI-only checkers (quantification, bullet_improver, skill_checker, section_checker)
 * are still handled by the Lambda backend.
 */

import type { CVAnalysis, CheckerResult, CVCorrections } from '@/components/cv-reviewer/types';

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
  'involved',
  'helped',
  'ensured', 'ensure', 'ensures',
  'worked',
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
  managements: 'management',
  developement: 'development',
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
  programmed: 'programmed',
  analysing: 'analyzing',
  analysed: 'analyzed',
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
  automate: 'automate',
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
  technolgy: 'technology',
  infrasturcture: 'infrastructure',
  infrastracture: 'infrastructure',
  desicion: 'decision',
  decison: 'decision',
  assesment: 'assessment',
  assesment: 'assessment',
  documentaion: 'documentation',
};

const CHECKER_ORDER: Array<CVCorrections['checkers'][0]['id']> = [
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

const CLIENT_SIDE_IDS = new Set(['bullet_length', 'weak_verb', 'verb_tense', 'repetition', 'spelling']);

// ─── Bullet extraction ────────────────────────────────────────────────────────

function extractBullets(analysis: CVAnalysis): string[] {
  const bullets: string[] = [];
  for (const exp of analysis.experience ?? []) {
    if (!exp.context) continue;
    const parts = exp.context
      .split(/[.\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 10);
    bullets.push(...parts);
  }
  return bullets;
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
        suggestion: 'Expand with context, tools used, or measurable outcome to reach 8–20 words.',
      });
    } else if (count > 25) {
      needsFix.push({
        text: bullet,
        issue: `Too long — ${count} words`,
        suggestion: 'Split into two bullets or trim filler words. Aim for 8–20 words per bullet.',
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
        suggestion: 'Replace with a strong action verb: Led, Built, Designed, Optimised, Delivered, etc.',
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

function checkVerbTense(experience: CVAnalysis['experience']): CheckerResult {
  const needsFix: CheckerResult['needsFix'] = [];
  const good: CheckerResult['good'] = [];

  // Detect if a duration string indicates a current role
  const isCurrent = (duration: string) =>
    /present|current|now|ongoing/i.test(duration);

  // Heuristic: does a verb look like past tense?
  // Past tense verbs typically end in -ed (or common irregular: led, built, drove, grew, etc.)
  const IRREGULAR_PAST = new Set([
    'led', 'built', 'drove', 'grew', 'ran', 'wrote', 'made', 'held', 'kept',
    'sent', 'set', 'won', 'cut', 'hit', 'left', 'met', 'paid', 'sold', 'told',
    'took', 'gave', 'got', 'put', 'brought', 'caught', 'found', 'got', 'lost',
    'read', 'sat', 'saw', 'said', 'stood', 'taught', 'thought', 'understood',
  ]);

  const isPastTense = (verb: string) =>
    verb.endsWith('ed') || IRREGULAR_PAST.has(verb);

  for (const exp of experience ?? []) {
    if (!exp.context) continue;
    const current = isCurrent(exp.duration ?? '');
    const bullets = exp.context
      .split(/[.\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 10);

    for (const bullet of bullets) {
      const firstWord = bullet.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
      if (!firstWord || firstWord.length < 3) continue;

      const past = isPastTense(firstWord);

      if (current && past) {
        needsFix.push({
          text: bullet,
          issue: 'Past tense used for current role — use present tense',
          suggestion: `Change "${firstWord}" to present tense (e.g. "${firstWord.replace(/ed$/, '')}").`,
        });
      } else if (!current && !past && /^[a-z]/.test(firstWord)) {
        // Potential present-tense verb in a past role
        // Only flag if it looks like a verb (ends in common verb endings or matches simple present)
        const looksLikePresentVerb = /(?:ize|ise|ate|ect|ign|ure|ive|ish|age|uce|ove|ule|ail|ain|eal|ess|ect)s?$|^(?:manage|lead|develop|design|build|create|implement|deploy|optimize|analyze|coordinate|deliver|drive|maintain|scale|automate|migrate|architect|own|run|handle|support|review|mentor|define|establish|launch|improve|reduce|increase)$/.test(firstWord);
        if (looksLikePresentVerb) {
          needsFix.push({
            text: bullet,
            issue: 'Present tense used for past role — use past tense',
            suggestion: `Change "${firstWord}" to past tense (e.g. "${firstWord}d" or "${firstWord}ed").`,
          });
        } else {
          good.push({ text: bullet, issue: '' });
        }
      } else {
        good.push({ text: bullet, issue: '' });
      }
    }
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

  // Count frequency of each opening verb
  const verbFreq: Map<string, number> = new Map();
  for (const bullet of bullets) {
    const verb = bullet.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
    if (verb.length >= 3) {
      verbFreq.set(verb, (verbFreq.get(verb) ?? 0) + 1);
    }
  }

  for (const bullet of bullets) {
    const verb = bullet.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
    const freq = verbFreq.get(verb) ?? 0;
    if (freq >= 3) {
      needsFix.push({
        text: bullet,
        issue: `Opening verb "${verb}" used ${freq} times`,
        suggestion: `Vary your action verbs — replace some occurrences of "${verb}" with synonyms.`,
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
        suggestion: `Correct: ${issues.join(', ')}.`,
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
 * Run all 5 client-side checkers on the given structured CVAnalysis.
 * Returns instantly (<10 ms).
 */
export function runClientCheckers(analysis: CVAnalysis): CheckerResult[] {
  const bullets = extractBullets(analysis);
  if (bullets.length === 0) return [];

  return [
    checkBulletLength(bullets),
    checkWeakVerbs(bullets),
    checkVerbTense(analysis.experience ?? []),
    checkRepetition(bullets),
    checkSpelling(bullets),
  ];
}

/**
 * Merge client-side CheckerResults with AI-generated ones.
 * Client-side results take precedence for the 5 client checkers.
 * AI results are used for quantification, bullet_improver, skill_checker, section_checker.
 * Result is sorted in canonical display order.
 */
export function mergeCorrections(
  clientCheckers: CheckerResult[],
  aiCheckers: CheckerResult[],
): CVCorrections | null {
  if (clientCheckers.length === 0 && aiCheckers.length === 0) return null;

  const byId = new Map<string, CheckerResult>();

  // AI first (lower priority for client-side IDs)
  for (const c of aiCheckers) {
    byId.set(c.id, c);
  }
  // Client-side overwrites for the 5 client checkers
  for (const c of clientCheckers) {
    if (CLIENT_SIDE_IDS.has(c.id)) {
      byId.set(c.id, c);
    }
  }

  const checkers = CHECKER_ORDER
    .map((id) => byId.get(id))
    .filter((c): c is CheckerResult => c !== undefined);

  return { checkers, generatedAt: new Date().toISOString() };
}
