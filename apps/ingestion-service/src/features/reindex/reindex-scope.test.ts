import { ReindexScope } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { reindexClears } from './reindex-scope';

describe('reindexClears', () => {
  it('clears only the vector for embeddings and both marks for skills', () => {
    expect(reindexClears(ReindexScope.Embeddings)).toEqual({
      embedding: true,
      skillsExtractedAt: false,
    });
    expect(reindexClears(ReindexScope.Skills)).toEqual({
      embedding: true,
      skillsExtractedAt: true,
    });
    expect(reindexClears(ReindexScope.All)).toEqual({
      embedding: true,
      skillsExtractedAt: true,
    });
  });
});
