import { SkillImportance, SkillType } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { buildExtractSkillsJsonSchema, parseModelSkills } from './extract-skills.schema';

describe('extract-skills schema', () => {
  it('accepts every skill type and importance, including domain and mentioned', () => {
    expect(
      parseModelSkills({
        skills: [
          {
            surface: 'SQL',
            skillType: SkillType.Domain,
            importance: SkillImportance.Mentioned,
            evidenceSpan: null,
            weight: 0,
          },
        ],
      }),
    ).toEqual({
      skills: [
        {
          surface: 'SQL',
          skillType: SkillType.Domain,
          importance: SkillImportance.Mentioned,
          evidenceSpan: null,
          weight: 0,
        },
      ],
    });
  });

  it('rejects an unknown type, a weight above 1, and an extra field', () => {
    expect(() => parseModelSkills({ skills: [{ surface: 'SQL', skillType: 'MAGIC' }] })).toThrow();
    expect(() =>
      parseModelSkills({
        skills: [
          {
            surface: 'SQL',
            skillType: SkillType.Hard,
            importance: SkillImportance.Required,
            evidenceSpan: null,
            weight: 1.4,
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      parseModelSkills({
        skills: [
          {
            surface: 'SQL',
            skillType: SkillType.Hard,
            importance: SkillImportance.Required,
            evidenceSpan: null,
            weight: 1,
            extra: true,
          },
        ],
      }),
    ).toThrow();
  });

  it('builds a strict object schema for the provider', () => {
    const schema = buildExtractSkillsJsonSchema();
    expect(schema.additionalProperties).toBe(false);
    expect(schema.type).toBe('object');
  });
});
