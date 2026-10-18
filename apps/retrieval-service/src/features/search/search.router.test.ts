import { RetrievalBranch } from '@hira/contracts';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { emptyIntent, type BranchSearch } from './run-branches';

const silentLogger = pino({ level: 'silent' });

describe('POST /internal/v1/search', () => {
  it('returns empty results and zero counts for a blank query', async () => {
    const search = recording();
    const response = await request(app(search))
      .post('/internal/v1/search')
      .set('X-Internal-Token', 'secret')
      .send({ intent: emptyIntent('  ') });
    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([]);
    expect(response.body.diagnostics.candidateCounts).toEqual({
      LEXICAL: 0,
      DENSE: 0,
      GRAPH: 0,
    });
    expect(response.body.diagnostics.fusedCount).toBe(0);
    expect(response.body.diagnostics.rerankApplied).toBe(false);
    expect(response.body.diagnostics.relaxationSteps).toEqual([]);
    expect(search.calls).toEqual([]);
  });

  it('rejects a body without a query and reports branch counts', async () => {
    const bad = await request(app(recording()))
      .post('/internal/v1/search')
      .set('X-Internal-Token', 'secret')
      .send({ limit: 10 });
    expect(bad.status).toBe(400);
    expect(bad.body.errorCode).toBe('VALIDATION_FAILED');

    const search = recording();
    search.lexical = [{ vacancyId: 'v', rank: 1, score: -0.4 }];
    const ok = await request(app(search))
      .post('/internal/v1/search')
      .set('X-Internal-Token', 'secret')
      .send({ intent: emptyIntent('python'), options: { branches: [RetrievalBranch.Lexical] } });
    expect(ok.status).toBe(200);
    expect(ok.body.results).toEqual([]);
    expect(ok.body.diagnostics.candidateCounts.LEXICAL).toBe(1);
    expect(ok.body.diagnostics.candidateCounts.DENSE).toBe(0);
    expect(ok.body.diagnostics.branchTimings.GRAPH).toBe(0);
  });

  it('answers 503 when the dense branch cannot embed the query', async () => {
    const search = recording();
    search.embedError = new Error('tei down');
    const response = await request(app(search))
      .post('/internal/v1/search')
      .set('X-Internal-Token', 'secret')
      .send({ intent: emptyIntent('python') });
    expect(response.status).toBe(503);
    expect(response.body.errorCode).toBe('RETRIEVAL_UNAVAILABLE');
    expect(response.body.results).toBeUndefined();
  });
});

function app(search: BranchSearch) {
  return createApp({
    logger: silentLogger,
    internalToken: 'secret',
    probes: [],
    search,
  });
}

function recording(): BranchSearch & {
  calls: string[];
  lexical: Array<{ vacancyId: string; rank: number; score: number }>;
  embedError?: Error;
} {
  const state = {
    calls: [] as string[],
    lexical: [] as Array<{ vacancyId: string; rank: number; score: number }>,
    embedError: undefined as Error | undefined,
  };
  return Object.assign(state, {
    searchBm25: async () => {
      state.calls.push('bm25');
      return state.lexical;
    },
    embedQuery: async () => {
      state.calls.push('embed');
      if (state.embedError !== undefined) throw state.embedError;
      return [0.1];
    },
    searchDense: async () => {
      state.calls.push('dense');
      return [];
    },
  });
}
