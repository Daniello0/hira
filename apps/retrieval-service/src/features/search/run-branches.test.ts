import { RetrievalBranch } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { emptyIntent, runBranches, type BranchSearch } from './run-branches';

describe('runBranches', () => {
  it('does not call a branch for a blank query', async () => {
    const search = recordingSearch();
    const run = await runBranches(emptyIntent('   '), undefined, search);
    expect(search.calls).toEqual([]);
    expect(run.lexical).toEqual([]);
    expect(run.dense).toEqual([]);
    expect(run.timings.GRAPH).toBe(0);
  });

  it('starts lexical search without waiting for the query vector', async () => {
    let release: (vector: number[]) => void = () => undefined;
    const gate = new Promise<number[]>((resolve) => {
      release = resolve;
    });
    let embedInvoked = false;
    let overlapped = false;
    const pending = runBranches(emptyIntent('python'), undefined, {
      searchBm25: () =>
        Promise.resolve().then(() => {
          overlapped = embedInvoked;
          return [{ vacancyId: 'v', rank: 1, score: -1 }];
        }),
      embedQuery: () => {
        embedInvoked = true;
        return gate;
      },
      searchDense: async () => [{ vacancyId: 'v', rank: 1, score: 0.2 }],
    });
    await Promise.resolve();
    expect(overlapped).toBe(true);
    release([0.1]);
    const run = await pending;
    expect(run.lexical).toHaveLength(1);
    expect(run.dense).toHaveLength(1);
  });

  it('skips the encoder for a lexical-only ablation and skips both for graph', async () => {
    const lexicalOnly = recordingSearch();
    await runBranches(emptyIntent('python'), { branches: [RetrievalBranch.Lexical] }, lexicalOnly);
    expect(lexicalOnly.calls).toEqual(['bm25']);
    const graphOnly = recordingSearch();
    await runBranches(emptyIntent('python'), { branches: [RetrievalBranch.Graph] }, graphOnly);
    expect(graphOnly.calls).toEqual([]);
  });
});

function recordingSearch(): BranchSearch & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    searchBm25: async () => {
      calls.push('bm25');
      return [];
    },
    embedQuery: async () => {
      calls.push('embed');
      return [0.1];
    },
    searchDense: async () => {
      calls.push('dense');
      return [];
    },
  };
}
