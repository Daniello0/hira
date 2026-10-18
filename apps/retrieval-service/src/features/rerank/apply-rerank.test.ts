import { RetrievalBranch } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import type { FusedHit } from '../fusion/rrf-fusion';
import { applyRerank } from './apply-rerank';

function fused(count: number): FusedHit[] {
  return Array.from({ length: count }, (_, index) => ({
    vacancyId: `v${index}`,
    rrfScore: count - index,
    retrievedBy: [RetrievalBranch.Lexical],
  }));
}

describe('applyRerank', () => {
  it('reorders the window of 20 and leaves the tail in RRF order', () => {
    const scores = Array.from({ length: 20 }, (_, index) => index);
    const page = applyRerank(fused(25), scores, 50);
    const ids = page.hits.map((hit) => hit.vacancyId);
    expect(page.rerankApplied).toBe(true);
    expect(ids.slice(0, 20)).toEqual(Array.from({ length: 20 }, (_, index) => `v${19 - index}`));
    expect(ids.slice(20)).toEqual(['v20', 'v21', 'v22', 'v23', 'v24']);
  });

  it('keeps RRF order when rerank is off or scores tie', () => {
    const off = applyRerank(fused(15), null, 10);
    expect(off.rerankApplied).toBe(false);
    expect(off.hits.map((hit) => hit.vacancyId)).toEqual(Array.from({ length: 10 }, (_, index) => `v${index}`));
    const tied = applyRerank(fused(3), [1, 1, 1], 3);
    expect(tied.hits.map((hit) => hit.vacancyId)).toEqual(['v0', 'v1', 'v2']);
  });
});
