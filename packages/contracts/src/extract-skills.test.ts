import { describe, expect, it } from 'vitest';
import { ReindexScope, SkillImportance, SkillType } from './index';
import type { ExtractSkillsResponse } from './index';

describe('stage 8 contracts', () => {
  it('names the reindex scopes from the ingestion API', () => {
    expect(Object.values(ReindexScope)).toEqual(['EMBEDDINGS', 'SKILLS', 'ALL']);
  });

  it('keeps an extracted skill inside the existing enums', () => {
    const response: ExtractSkillsResponse = {
      results: [
        {
          id: 'v1',
          skills: [
            {
              surface: 'Python',
              skillType: SkillType.Domain,
              importance: SkillImportance.Mentioned,
              evidenceSpan: null,
              weight: 0.2,
            },
          ],
        },
      ],
    };
    expect(response.results[0]?.skills[0]?.skillType).toBe('DOMAIN');
  });
});
