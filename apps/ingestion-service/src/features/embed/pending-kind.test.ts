import { describe, expect, it } from 'vitest';
import {
  EMBED_CLAIM_LIMIT,
  SKILL_CLAIM_LIMIT,
  SKILL_DEV_CAP,
  claimLimit,
  needsSkillExtraction,
  needsVacancyEmbedding,
} from './pending-kind';

describe('pending work', () => {
  it('extracts before it embeds', () => {
    expect(needsSkillExtraction({ skillsExtractedAt: null })).toBe(true);
    expect(needsVacancyEmbedding({ skillsExtractedAt: null, embedding: null })).toBe(false);
    expect(needsVacancyEmbedding({ skillsExtractedAt: new Date(), embedding: null })).toBe(true);
    expect(needsVacancyEmbedding({ skillsExtractedAt: new Date(), embedding: '[0]' })).toBe(false);
    expect(needsSkillExtraction({ skillsExtractedAt: new Date() })).toBe(false);
  });

  it('claims 20 skills and 32 embeddings, and caps a skill run at 1000', () => {
    expect(SKILL_CLAIM_LIMIT).toBe(20);
    expect(EMBED_CLAIM_LIMIT).toBe(32);
    expect(SKILL_DEV_CAP).toBe(1000);
    expect(claimLimit('skills')).toBe(20);
    expect(claimLimit('embed')).toBe(32);
    expect(claimLimit('skills', 5000)).toBe(1000);
    expect(claimLimit('embed', 100)).toBe(32);
    expect(claimLimit('skills', 0)).toBe(0);
  });
});
