import { tokenize } from '../nlp/tokenizer';
import { computeKeywordOverlap } from '../nlp/tfidf';
import { getCanonical, areSynonyms } from '../nlp/synonyms';

interface KeywordMatchResult {
	score: number;
	matched: string[];
	missing: string[];
	synonymMatched: string[];
}

// matches resume keywords against JD keywords using exact, fuzzy, or semantic strategy
// strategy reflects real ATS strictness (exact for Workday/Taleo, semantic for Greenhouse/Lever)
export function matchKeywords(
	resumeText: string,
	jobDescription: string,
	strategy: 'exact' | 'fuzzy' | 'semantic'
): KeywordMatchResult {
	if (!jobDescription || jobDescription.trim().length === 0) {
		return { score: 100, matched: [], missing: [], synonymMatched: [] };
	}

	// extract tokens from both texts
	const resumeTokens = tokenize(resumeText);
	const jdTokens = tokenize(jobDescription);

	const resumeTerms = new Set(resumeTokens.map((t) => t.normalized));
	// Only surface JD terms that look like meaningful skills/tools/domain terms:
	// - length >= 3 (filters noise like "rx", "go" ambiguity)
	// - AND: originally capitalised in the JD (proper noun / product name),
	//        OR contains a digit (Python3, ES6), special tech chars (+, #, .),
	//        OR is long enough to be domain-specific (>= 6 chars)
	const allJdTerms = [...new Set(jdTokens.map((t) => t.normalized))];
	const jdTerms = allJdTerms.filter((term) => {
		if (term.length < 3) return false;
		// acronyms preserved as-is (e.g. sql → SQL check skipped since already lowercase)
		if (/\d/.test(term)) return true;                          // contains digit
		if (/[+#.]/.test(term)) return true;                       // tech special chars
		if (term.includes('-')) return true;                       // compound term
		if (term.length >= 6) return true;                         // long enough to be specific
		// short term (3-5 chars): only keep if it was capitalised in original JD text
		// (e.g. "React", "Swift", "Redis", "AWS", "SQL" appear capitalised)
		const capitalised = new RegExp(`\\b${term[0].toUpperCase()}${term.slice(1)}\\b`);
		return capitalised.test(jobDescription);
	});

	// also extract canonical forms for synonym matching
	const resumeCanonicals = new Set(resumeTokens.map((t) => getCanonical(t.normalized)));

	const matched: string[] = [];
	const missing: string[] = [];
	const synonymMatched: string[] = [];

	for (const jdTerm of jdTerms) {
		// exact match
		if (resumeTerms.has(jdTerm)) {
			matched.push(jdTerm);
			continue;
		}

		if (strategy === 'exact') {
			missing.push(jdTerm);
			continue;
		}

		// fuzzy: check synonym database
		const jdCanonical = getCanonical(jdTerm);
		if (resumeCanonicals.has(jdCanonical)) {
			synonymMatched.push(jdTerm);
			continue;
		}

		// also check if any resume term is a synonym of the JD term
		let foundSynonym = false;
		for (const resumeTerm of resumeTerms) {
			if (areSynonyms(resumeTerm, jdTerm)) {
				synonymMatched.push(jdTerm);
				foundSynonym = true;
				break;
			}
		}
		if (foundSynonym) continue;

		if (strategy === 'fuzzy') {
			missing.push(jdTerm);
			continue;
		}

		// semantic: partial string matching (contains, prefix)
		let foundPartial = false;
		for (const resumeTerm of resumeTerms) {
			// check if either term contains the other
			if (resumeTerm.includes(jdTerm) || jdTerm.includes(resumeTerm)) {
				if (Math.min(resumeTerm.length, jdTerm.length) >= 3) {
					synonymMatched.push(jdTerm);
					foundPartial = true;
					break;
				}
			}
		}
		if (foundPartial) continue;

		// also check the full resume text for multi-word JD terms
		if (jdTerm.length >= 4 && resumeText.toLowerCase().includes(jdTerm)) {
			matched.push(jdTerm);
			continue;
		}

		missing.push(jdTerm);
	}

	// calculate score
	const totalJdTerms = jdTerms.length;
	if (totalJdTerms === 0) return { score: 100, matched, missing, synonymMatched };

	// exact matches count full, synonym matches count 80%
	const effectiveMatches = matched.length + synonymMatched.length * 0.8;
	const score = Math.round(Math.min(100, (effectiveMatches / totalJdTerms) * 100));

	return { score, matched, missing, synonymMatched };
}

// quick keyword overlap check without synonym matching, used for no-JD scoring mode
export function quickKeywordScore(resumeText: string, referenceText: string): number {
	const overlap = computeKeywordOverlap(resumeText, referenceText);
	return Math.round(overlap.score * 100);
}
