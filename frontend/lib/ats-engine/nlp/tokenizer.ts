// stop words to exclude from keyword analysis (common english words with no semantic weight)
const STOP_WORDS = new Set([
	'a',
	'an',
	'the',
	'and',
	'or',
	'but',
	'in',
	'on',
	'at',
	'to',
	'for',
	'of',
	'with',
	'by',
	'from',
	'as',
	'is',
	'was',
	'are',
	'were',
	'be',
	'been',
	'being',
	'have',
	'has',
	'had',
	'do',
	'does',
	'did',
	'will',
	'would',
	'could',
	'should',
	'may',
	'might',
	'shall',
	'can',
	'need',
	'not',
	'no',
	'nor',
	'so',
	'if',
	'then',
	'than',
	'too',
	'very',
	'just',
	'about',
	'above',
	'after',
	'again',
	'all',
	'also',
	'am',
	'any',
	'because',
	'before',
	'between',
	'both',
	'each',
	'few',
	'further',
	'get',
	'got',
	'here',
	'how',
	'i',
	'into',
	'it',
	'its',
	'me',
	'more',
	'most',
	'my',
	'myself',
	'now',
	'only',
	'other',
	'our',
	'out',
	'over',
	'own',
	'same',
	'she',
	'he',
	'her',
	'him',
	'his',
	'some',
	'such',
	'that',
	'their',
	'them',
	'there',
	'these',
	'they',
	'this',
	'those',
	'through',
	'under',
	'until',
	'up',
	'us',
	'we',
	'what',
	'when',
	'where',
	'which',
	'while',
	'who',
	'whom',
	'why',
	'you',
	'your',
	'etc',
	'ie',
	'eg',
	'per',
	'via',
	// Extended: common JD prose words with no ATS keyword signal
	// Roles / org structure
	'role', 'position', 'candidate', 'applicant', 'hire', 'hiring', 'hired',
	'team', 'company', 'organization', 'organisation', 'business', 'department',
	'office', 'group', 'division', 'unit', 'member', 'members', 'individual',
	'person', 'people', 'colleague', 'colleagues', 'partner', 'partners',
	// Descriptors (non-technical)
	'strong', 'excellent', 'great', 'good', 'ideal', 'preferred', 'desired',
	'required', 'key', 'critical', 'important', 'relevant', 'related', 'core',
	'essential', 'primary', 'secondary', 'main', 'major', 'minor', 'general',
	'specific', 'additional', 'various', 'multiple', 'several', 'numerous',
	'fast', 'high', 'low', 'large', 'small', 'big', 'broad', 'deep', 'wide',
	'new', 'old', 'current', 'previous', 'next', 'latest', 'recent',
	// Generic verbs (not skills)
	'work', 'working', 'worked', 'works',
	'help', 'helping', 'helped', 'helps',
	'ensure', 'ensuring', 'ensured',
	'provide', 'providing', 'provided', 'provides',
	'find', 'finding', 'found',
	'discover', 'discovering', 'discovered',
	'join', 'joining', 'joined',
	'build', 'building', 'built',
	'grow', 'growing', 'grew', 'grown',
	'strive', 'striving', 'strived', 'strives',
	'drive', 'driving', 'drove', 'driven', 'drives',
	'make', 'making', 'made', 'makes',
	'take', 'taking', 'took', 'taken', 'takes',
	'give', 'giving', 'gave', 'given', 'gives',
	'come', 'coming', 'came', 'comes',
	'go', 'going', 'went', 'gone', 'goes',
	'look', 'looking', 'looked', 'looks',
	'use', 'using', 'used', 'uses',
	'know', 'knowing', 'knew', 'known', 'knows',
	'think', 'thinking', 'thought', 'thinks',
	'want', 'wanting', 'wanted', 'wants',
	'need', 'needing', 'needed', 'needs',
	'get', 'getting', 'got', 'gotten', 'gets',
	'set', 'setting', 'sets',
	'see', 'seeing', 'saw', 'seen', 'sees',
	'show', 'showing', 'showed', 'shown', 'shows',
	'keep', 'keeping', 'kept', 'keeps',
	'move', 'moving', 'moved', 'moves',
	'bring', 'bringing', 'brought', 'brings',
	'include', 'including', 'included', 'includes',
	'apply', 'applying', 'applied', 'applies',
	// Adverbs / qualifiers
	'virtually', 'ideally', 'preferably', 'particularly', 'primarily',
	'generally', 'typically', 'effectively', 'efficiently', 'successfully',
	'directly', 'closely', 'highly', 'deeply', 'broadly', 'quickly',
	'well', 'best', 'better', 'less', 'least', 'most', 'much', 'many',
	// Vague nouns
	'ability', 'background', 'understanding', 'environment', 'opportunity',
	'career', 'culture', 'mission', 'vision', 'value', 'values', 'goal',
	'goals', 'result', 'results', 'impact', 'success', 'growth', 'change',
	'experience', 'knowledge', 'skill', 'skills', 'expertise', 'approach',
	'focus', 'area', 'areas', 'field', 'sector', 'industry', 'space',
	'way', 'ways', 'type', 'types', 'kind', 'kinds', 'level', 'levels',
	'part', 'parts', 'aspect', 'aspects', 'feature', 'features',
	'end', 'start', 'point', 'points', 'step', 'steps', 'process',
	// Indefinite / generic pronouns
	'anything', 'something', 'nothing', 'everything',
	'anyone', 'someone', 'everyone', 'nobody', 'somebody', 'everybody',
	// Time words
	'day', 'days', 'time', 'times', 'week', 'weeks', 'month', 'months',
	'year', 'years', 'date', 'period', 'duration',
	// Misc JD boilerplate
	'plus', 'bonus', 'nice', 'must', 'minimum', 'maximum', 'least',
	'across', 'within', 'outside', 'inside', 'around', 'beyond',
	'along', 'among', 'between', 'against', 'without', 'throughout',
]);

export interface Token {
	raw: string;
	normalized: string;
	position: number;
}

// tokenizes text into terms: lowercase, strip punctuation, filter stop words
export function tokenize(text: string): Token[] {
	const words = text.split(/[\s,;|]+/);
	const tokens: Token[] = [];

	for (let i = 0; i < words.length; i++) {
		const raw = words[i];
		// strip leading/trailing punctuation but preserve internal hyphens and dots
		const cleaned = raw.replace(/^[^a-zA-Z0-9#+]+|[^a-zA-Z0-9#+]+$/g, '');
		if (cleaned.length === 0) continue;

		const normalized = cleaned.toLowerCase();
		if (STOP_WORDS.has(normalized)) continue;
		if (normalized.length < 2) continue;

		tokens.push({ raw: cleaned, normalized, position: i });
	}

	return tokens;
}

// extracts n-grams (multi-word phrases) for matching compound skills
export function extractNgrams(text: string, n: number): string[] {
	const words = text
		.toLowerCase()
		.split(/[\s,;|]+/)
		.map((w) => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
		.filter((w) => w.length > 0);

	if (words.length < n) return [];

	const ngrams: string[] = [];
	for (let i = 0; i <= words.length - n; i++) {
		const gram = words.slice(i, i + n).join(' ');
		// skip n-grams that are entirely stop words
		const hasContent = words.slice(i, i + n).some((w) => !STOP_WORDS.has(w));
		if (hasContent) ngrams.push(gram);
	}

	return ngrams;
}

// extracts unique terms combining unigrams, bigrams, and trigrams
export function extractTerms(text: string): string[] {
	const tokens = tokenize(text);
	const unigrams = tokens.map((t) => t.normalized);
	const bigrams = extractNgrams(text, 2);
	const trigrams = extractNgrams(text, 3);

	const all = [...unigrams, ...bigrams, ...trigrams];
	return [...new Set(all)];
}

// normalizes text for comparison: lowercase, trim, collapse whitespace
export function normalizeText(text: string): string {
	return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

export { STOP_WORDS };
