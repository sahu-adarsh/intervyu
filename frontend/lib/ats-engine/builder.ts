import type { CVAnalysis } from '@/components/cv-reviewer/types';
import type { ScoringInput } from './scorer/types';

// converts CVAnalysis (structured backend output) into ScoringInput for the ATS engine.
// since we parse server-side and only have structured data (not raw text), we reconstruct
// a virtual plain-text resume from the analysis fields.
export function buildScoringInput(
  analysis: CVAnalysis,
  jobDescription?: string
): ScoringInput {

  // ── 1. Reconstruct resumeText ────────────────────────────────────────────
  const parts: string[] = [];

  // Contact block
  if (analysis.candidateName) parts.push(analysis.candidateName);
  if (analysis.email) parts.push(analysis.email);
  if (analysis.phone) parts.push(analysis.phone);

  // Summary
  if (analysis.summary?.trim()) {
    parts.push('Summary');
    parts.push(analysis.summary.trim());
  }

  // Experience — structured as bullet-style sentences
  if ((analysis.experience?.length ?? 0) > 0) {
    parts.push('Experience');
    for (const exp of analysis.experience ?? []) {
      if (exp.role) parts.push(exp.role);
      if (exp.company) parts.push(exp.company);
      if (exp.duration) parts.push(exp.duration);
      if (exp.context) parts.push(exp.context);
    }
  }

  // Skills
  const allSkills = [
    ...(analysis.skills ?? []),
    ...(analysis.technologies ?? []),
  ];
  const uniqueSkills = [...new Set(allSkills)];
  if (uniqueSkills.length > 0) {
    parts.push('Skills');
    parts.push(uniqueSkills.join(', '));
  }

  // Education
  if ((analysis.education?.length ?? 0) > 0) {
    parts.push('Education');
    for (const edu of analysis.education ?? []) {
      const line = [edu.degree, edu.institution, edu.year, edu.context]
        .filter(Boolean)
        .join(' ');
      parts.push(line);
    }
  }

  const resumeText = parts.join('\n');

  // ── 2. resumeSkills ──────────────────────────────────────────────────────
  const resumeSkills = uniqueSkills;

  // ── 3. resumeSections ───────────────────────────────────────────────────
  // Derive from which structured fields are populated.
  // Section names must match the strings used in profile.requiredSections
  const resumeSections: string[] = [];

  const hasContact =
    !!analysis.candidateName || !!analysis.email || !!analysis.phone;
  if (hasContact) resumeSections.push('contact');

  if ((analysis.experience?.length ?? 0) > 0) resumeSections.push('experience');
  if ((analysis.education?.length ?? 0) > 0) resumeSections.push('education');
  if (uniqueSkills.length > 0) resumeSections.push('skills');
  if (analysis.summary?.trim()) resumeSections.push('summary');

  // ── 4. educationText ────────────────────────────────────────────────────
  // education-scorer looks for degree keywords, capitalized institution names,
  // graduation years, field-of-study phrases, GPA, and honors.
  // We join all education entries preserving case for institution-name regex.
  const educationText = (analysis.education ?? [])
    .map((e) =>
      [e.degree, e.institution, e.year, e.context].filter(Boolean).join(' ')
    )
    .join('\n');

  // ── 5. experienceBullets ─────────────────────────────────────────────────
  // Split each experience entry's context field into individual bullets/sentences.
  // Filter out fragments shorter than 10 chars (durations, single words).
  const experienceBullets: string[] = [];
  for (const exp of analysis.experience ?? []) {
    if (!exp.context) continue;
    const rawBullets = exp.context
      .split(/[.\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 10);
    experienceBullets.push(...rawBullets);
  }

  // ── 6. Format flags ──────────────────────────────────────────────────────
  // Backend text extraction linearizes content, so we default all flags to false.
  const hasMultipleColumns = false;
  const hasTables = false;
  const hasImages = false;

  // ── 7. wordCount ─────────────────────────────────────────────────────────
  // Floor at 300 because the reconstruction is much more condensed than an actual
  // resume — without the floor, short analyses would trigger the "resume too short"
  // formatting penalty (threshold: 150 words).
  const rawWordCount = resumeText.split(/\s+/).filter(Boolean).length;
  const wordCount = Math.max(300, rawWordCount);

  // ── 8. pageCount ─────────────────────────────────────────────────────────
  // Estimate from word count: typical resume = ~400 words/page. Always at least 1.
  const pageCount = Math.max(1, Math.ceil(wordCount / 400));

  return {
    resumeText,
    resumeSkills,
    resumeSections,
    experienceBullets,
    educationText,
    hasMultipleColumns,
    hasTables,
    hasImages,
    pageCount,
    wordCount,
    jobDescription: jobDescription?.trim() || undefined,
  };
}
