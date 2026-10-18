import { QueryComplexity, RetrievalBranch } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { RRF_K } from '../search/search.constants';
import { fuseBranches } from './rrf-fusion';

const active = [RetrievalBranch.Lexical, RetrievalBranch.Dense, RetrievalBranch.Graph];

describe('fuseBranches', () => {
  it('adds one term for a document that a single branch returned', () => {
    const fused = fuseBranches(
      { [RetrievalBranch.Lexical]: [{ vacancyId: 'only', rank: 1, score: -3 }] },
      QueryComplexity.Simple,
      undefined,
      [RetrievalBranch.Lexical],
    );
    expect(fused).toEqual([
      { vacancyId: 'only', rrfScore: 0.4 / (RRF_K + 1), retrievedBy: [RetrievalBranch.Lexical] },
    ]);
  });

  it('uses the SIMPLE graph weight 0.1 and replaces only the named override', () => {
    const graph = fuseBranches(
      { [RetrievalBranch.Graph]: [{ vacancyId: 'g', rank: 1, score: 0.5 }] },
      QueryComplexity.Simple,
      undefined,
      active,
    );
    expect(graph[0]?.rrfScore).toBeCloseTo(0.1 / (RRF_K + 1));
    const mixed = fuseBranches(
      {
        [RetrievalBranch.Lexical]: [{ vacancyId: 'both', rank: 1, score: -1 }],
        [RetrievalBranch.Graph]: [{ vacancyId: 'both', rank: 1, score: 1 }],
        [RetrievalBranch.Dense]: [{ vacancyId: 'dense', rank: 1, score: 0.2 }],
      },
      QueryComplexity.Simple,
      { [RetrievalBranch.Graph]: 0.9 },
      active,
    );
    const both = mixed.find((hit) => hit.vacancyId === 'both');
    const dense = mixed.find((hit) => hit.vacancyId === 'dense');
    expect(both?.rrfScore).toBeCloseTo(0.4 / (RRF_K + 1) + 0.9 / (RRF_K + 1));
    expect(dense?.rrfScore).toBeCloseTo(0.5 / (RRF_K + 1));
  });

  it('breaks an equal score toward the smaller id and ignores a branch that did not run', () => {
    const tied = fuseBranches(
      {
        [RetrievalBranch.Lexical]: [{ vacancyId: 'b', rank: 1, score: -1 }],
        [RetrievalBranch.Dense]: [{ vacancyId: 'a', rank: 1, score: 0.2 }],
      },
      QueryComplexity.Simple,
      { [RetrievalBranch.Lexical]: 0.5 },
      [RetrievalBranch.Lexical, RetrievalBranch.Dense],
    );
    expect(tied.map((hit) => hit.vacancyId)).toEqual(['a', 'b']);
    const skipped = fuseBranches(
      { [RetrievalBranch.Graph]: [{ vacancyId: 'g', rank: 1, score: 1 }] },
      QueryComplexity.Simple,
      undefined,
      [RetrievalBranch.Lexical],
    );
    expect(skipped).toEqual([]);
  });

  it('counts a repeated branch once', () => {
    const hits = { [RetrievalBranch.Lexical]: [{ vacancyId: 'only', rank: 1, score: -3 }] };
    const once = fuseBranches(hits, QueryComplexity.Simple, undefined, [RetrievalBranch.Lexical]);
    const twice = fuseBranches(hits, QueryComplexity.Simple, undefined, [
      RetrievalBranch.Lexical,
      RetrievalBranch.Lexical,
    ]);
    expect(twice).toEqual(once);
  });
});
