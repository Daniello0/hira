/** How many vacancies one skill tick claims. Wiki schedule batch. */
export const SKILL_CLAIM_LIMIT = 20;

/** How many texts one embed request sends. Wiki schedule batch. */
export const EMBED_CLAIM_LIMIT = 32;

/** Dev ceiling for one skill run. The upper bound of the recorded 500–1000 range. */
export const SKILL_DEV_CAP = 1000;

/** True while skills have not been extracted. */
export function needsSkillExtraction(row: { skillsExtractedAt: Date | null }): boolean {
  return row.skillsExtractedAt === null;
}

/** True only after skills exist and the vacancy vector is still empty. */
export function needsVacancyEmbedding(row: {
  skillsExtractedAt: Date | null;
  embedding: string | null;
}): boolean {
  return row.skillsExtractedAt !== null && row.embedding === null;
}

/** Default claim size for a tick, clamped so a skill run stays inside the dev cap. */
export function claimLimit(kind: 'skills' | 'embed', requested?: number): number {
  const fallback = kind === 'skills' ? SKILL_CLAIM_LIMIT : EMBED_CLAIM_LIMIT;
  const cap = kind === 'skills' ? SKILL_DEV_CAP : EMBED_CLAIM_LIMIT;
  const asked = requested ?? fallback;
  if (asked <= 0) return 0;
  return Math.min(asked, cap);
}
