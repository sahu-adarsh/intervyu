import type { ATSProfile, ScoringInput, ScoreResult, ScoreBreakdown, StructuredSuggestion } from './types';
import { ALL_PROFILES } from './profiles';
import { scoreFormatting } from './format-scorer';
import { scoreSections } from './section-scorer';
import { scoreExperience } from './experience-scorer';
import { scoreEducation } from './education-scorer';
import { matchKeywords } from './keyword-matcher';

// scores a resume against all 6 ATS profiles. deterministic: same input = same output
export function scoreResume(input: ScoringInput): ScoreResult[] {
	return ALL_PROFILES.map((profile) => scoreAgainstProfile(input, profile));
}

// scores a resume against a single ATS profile
export function scoreAgainstProfile(input: ScoringInput, profile: ATSProfile): ScoreResult {
	const breakdown = computeBreakdown(input, profile);
	const weightedScore = computeWeightedScore(breakdown, profile);

	// apply quirk penalties/bonuses
	const quirkAdjustment = computeQuirkAdjustment(input, profile);
	const overallScore = Math.max(
		0,
		Math.min(100, Math.round(weightedScore + quirkAdjustment.totalAdjustment))
	);

	const suggestions = generateSuggestions(breakdown, profile, quirkAdjustment.messages);

	return {
		system: profile.name,
		vendor: profile.vendor,
		overallScore,
		passesFilter: overallScore >= profile.passingScore,
		breakdown,
		suggestions
	};
}

// runs each individual scorer and assembles the breakdown
function computeBreakdown(input: ScoringInput, profile: ATSProfile): ScoreBreakdown {
	const formatting = scoreFormatting(input, profile.parsingStrictness);
	const sections = scoreSections(input.resumeSections, profile.requiredSections);
	const experience = scoreExperience(input.experienceBullets);
	const education = scoreEducation(input.educationText);
	const keywords = matchKeywords(
		input.resumeText,
		input.jobDescription || '',
		profile.keywordStrategy
	);

	return {
		formatting: {
			score: formatting.score,
			issues: formatting.issues,
			details: formatting.details
		},
		keywordMatch: {
			score: keywords.score,
			matched: keywords.matched,
			missing: keywords.missing,
			synonymMatched: keywords.synonymMatched
		},
		sections: {
			score: sections.score,
			present: sections.present,
			missing: sections.missing
		},
		experience: {
			score: experience.score,
			quantifiedBullets: experience.quantifiedBullets,
			totalBullets: experience.totalBullets,
			actionVerbCount: experience.actionVerbCount,
			highlights: experience.highlights
		},
		education: {
			score: education.score,
			notes: education.notes
		}
	};
}

// applies profile weights to produce a single 0-100 score
function computeWeightedScore(breakdown: ScoreBreakdown, profile: ATSProfile): number {
	const { weights } = profile;

	// quantification is derived from the experience scorer's quantification ratio
	const quantificationScore =
		breakdown.experience.totalBullets > 0
			? Math.round(
					(breakdown.experience.quantifiedBullets / breakdown.experience.totalBullets) * 100
				)
			: 0;

	const weighted =
		breakdown.formatting.score * weights.formatting +
		breakdown.keywordMatch.score * weights.keywordMatch +
		breakdown.sections.score * weights.sectionCompleteness +
		breakdown.experience.score * weights.experienceRelevance +
		breakdown.education.score * weights.educationMatch +
		quantificationScore * weights.quantification;

	return weighted;
}

// runs quirk checks for a profile. negative penalty = bonus, positive = deduction
function computeQuirkAdjustment(
	input: ScoringInput,
	profile: ATSProfile
): { totalAdjustment: number; messages: string[] } {
	let totalAdjustment = 0;
	const messages: string[] = [];

	for (const quirk of profile.quirks) {
		const result = quirk.check(input);
		if (result) {
			totalAdjustment -= result.penalty;
			messages.push(result.message);
		}
	}

	return { totalAdjustment, messages };
}

// generates structured suggestions with impact level, platform attribution, and detail bullets
function generateSuggestions(
	breakdown: ScoreBreakdown,
	profile: ATSProfile,
	quirkMessages: string[]
): StructuredSuggestion[] {
	const suggestions: StructuredSuggestion[] = [];

	// formatting suggestions
	if (breakdown.formatting.score < 70) {
		if (breakdown.formatting.issues.some((i) => i.includes('multi-column'))) {
			suggestions.push({
				summary: 'Switch to a single-column resume layout',
				details: [
					'Multi-column layouts cause ATS parsers to read text out of order, mixing content from different sections.',
					'Content in side columns is often skipped entirely or merged with the wrong section.',
					'Use a clean, top-to-bottom single-column structure for reliable parsing.'
				],
				impact: 'critical',
				platforms: [profile.name]
			});
		}
		if (breakdown.formatting.issues.some((i) => i.includes('tables'))) {
			suggestions.push({
				summary: 'Remove tables and replace with plain text',
				details: [
					'Tables are poorly supported by most ATS parsers — cell content may be skipped or merged incorrectly.',
					'Replace table-based skills or layouts with simple comma-separated lists or plain bullet points.'
				],
				impact: 'critical',
				platforms: [profile.name]
			});
		}
		if (breakdown.formatting.issues.some((i) => i.includes('images'))) {
			suggestions.push({
				summary: 'Remove images, logos, and graphics',
				details: [
					'ATS systems cannot read text embedded in images — icons, logos, and headshots are invisible to parsers.',
					'Remove all graphics including skill-bar charts, profile photos, and company logos.'
				],
				impact: 'high',
				platforms: [profile.name]
			});
		}
	}

	// keyword suggestions
	if (breakdown.keywordMatch.score < 60 && breakdown.keywordMatch.missing.length > 0) {
		const topMissing = breakdown.keywordMatch.missing.slice(0, 5);
		const isExact = profile.keywordStrategy === 'exact';
		suggestions.push({
			summary: `Add missing keywords: ${topMissing.join(', ')}`,
			details: [
				'These terms appear in the job description but were not found in your resume.',
				isExact
					? `${profile.name} uses exact keyword matching — synonyms and abbreviations will not count. Use the precise terms from the job posting.`
					: 'Weave these keywords naturally into your experience bullets and skills section.',
				'Keyword match is one of the highest-weighted dimensions in ATS scoring.'
			],
			impact: breakdown.keywordMatch.score < 30 ? 'critical' : 'high',
			platforms: [profile.name]
		});
	}

	// section suggestions
	if (breakdown.sections.missing.length > 0) {
		const missing = breakdown.sections.missing;
		suggestions.push({
			summary: `Add missing sections: ${missing.join(', ')}`,
			details: [
				`${profile.name} requires clearly labelled sections for proper field mapping.`,
				'Missing sections may cause your application to be auto-rejected before a human reviews it.',
				`Ensure your resume has standard headers: ${missing.map((s) => `"${s.charAt(0).toUpperCase() + s.slice(1)}"`).join(', ')}.`
			],
			impact: missing.length > 1 ? 'critical' : 'high',
			platforms: [profile.name]
		});
	}

	// experience suggestions
	if (breakdown.experience.totalBullets > 0) {
		const quantRatio = breakdown.experience.quantifiedBullets / breakdown.experience.totalBullets;
		if (quantRatio < 0.3) {
			suggestions.push({
				summary: 'Add quantified achievements to experience bullets',
				details: [
					`Currently ${Math.round(quantRatio * 100)}% of your bullets include a metric. Aim for 40%+.`,
					'Use numbers, percentages, dollar amounts, or scale: "reduced latency by 40%", "served 50K users", "cut costs by $200K".',
					'Quantified bullets score significantly higher on experience-weighted platforms like Greenhouse and Lever.'
				],
				impact: quantRatio < 0.1 ? 'high' : 'medium',
				platforms: [profile.name]
			});
		}
		if (breakdown.experience.actionVerbCount / breakdown.experience.totalBullets < 0.5) {
			suggestions.push({
				summary: 'Start more bullets with strong action verbs',
				details: [
					`Currently ${Math.round((breakdown.experience.actionVerbCount / breakdown.experience.totalBullets) * 100)}% of bullets begin with a recognised action verb. Aim for 70%+.`,
					'Strong openers: Led, Developed, Reduced, Delivered, Architected, Increased, Launched, Optimised.',
					'Avoid passive phrasing like "was responsible for" or "helped with" — these score poorly.'
				],
				impact: 'medium',
				platforms: [profile.name]
			});
		}
	} else {
		suggestions.push({
			summary: 'Add detailed experience bullets with measurable achievements',
			details: [
				'No experience bullets were detected. ATS systems score experience quality based on bullet content.',
				'Each role should have 3–6 bullets describing what you did, with at least 2 including a metric.',
				'Format: "[Action verb] [what you did] resulting in [measurable outcome]".'
			],
			impact: 'critical',
			platforms: [profile.name]
		});
	}

	// education suggestions
	if (breakdown.education.score < 50) {
		suggestions.push({
			summary: 'Complete your education section',
			details: [
				'Include degree type (e.g. Bachelor of Science), institution name, and graduation year.',
				'Missing structured education data reduces your score on strict platforms like Workday and SuccessFactors.',
				'If you have certifications, list them here as well.'
			],
			impact: 'medium',
			platforms: [profile.name]
		});
	}

	// quirk-specific suggestions (platform-unique rules)
	for (const message of quirkMessages) {
		suggestions.push({
			summary: message.charAt(0).toUpperCase() + message.slice(1),
			details: [`This is a ${profile.name}-specific parsing rule that affects your score on this platform.`],
			impact: 'medium',
			platforms: [profile.name]
		});
	}

	return suggestions;
}
