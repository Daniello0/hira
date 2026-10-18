import {
  Language,
  RetrievalBranch,
  VacancySource,
  VacancyStatus,
  type VacancyDto,
} from '@hira/contracts';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { emptyIntent } from './run-branches';
import type { SearchPorts } from './run-search';

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

  it('answers 503 when the graph branch fails and does not run it for a lexical ablation', async () => {
    const failing = recording();
    failing.graphError = new Error('cte down');
    const down = await request(app(failing))
      .post('/internal/v1/search')
      .set('X-Internal-Token', 'secret')
      .send({ intent: emptyIntent('python'), options: { branches: [RetrievalBranch.Graph] } });
    expect(down.status).toBe(503);
    expect(down.body.results).toBeUndefined();

    const lexical = recording();
    await request(app(lexical))
      .post('/internal/v1/search')
      .set('X-Internal-Token', 'secret')
      .send({
        intent: emptyIntent('python'),
        options: { branches: [RetrievalBranch.Lexical, RetrievalBranch.Dense], rerank: false },
      });
    expect(lexical.calls).not.toContain('graph');
    expect(lexical.calls).not.toContain('resolve');
  });

  it('keeps RRF order when the reranker fails', async () => {
    const search = recording();
    search.lexical = [
      { vacancyId: 'b', rank: 1, score: -1 },
      { vacancyId: 'a', rank: 2, score: -0.2 },
    ];
    search.rows = [loaded('b'), loaded('a')];
    search.rerankError = new Error('rerank down');
    const response = await request(app(search))
      .post('/internal/v1/search')
      .set('X-Internal-Token', 'secret')
      .send({ intent: emptyIntent('python'), options: { branches: [RetrievalBranch.Lexical] } });
    expect(response.status).toBe(200);
    expect(response.body.diagnostics.rerankApplied).toBe(false);
    expect(response.body.results.map((row: { vacancy: { id: string } }) => row.vacancy.id)).toEqual(
      ['b', 'a'],
    );
    expect(response.body.results[0].score).toBe(response.body.results[0].explanation.totalScore);
  });
});

function app(search: SearchPorts) {
  return createApp({
    logger: silentLogger,
    internalToken: 'secret',
    probes: [],
    search,
  });
}

function recording(): SearchPorts & {
  calls: string[];
  lexical: Array<{ vacancyId: string; rank: number; score: number }>;
  rows: ReturnType<typeof loaded>[];
  embedError?: Error;
  graphError?: Error;
  rerankError?: Error;
} {
  const state = {
    calls: [] as string[],
    lexical: [] as Array<{ vacancyId: string; rank: number; score: number }>,
    rows: [] as ReturnType<typeof loaded>[],
    embedError: undefined as Error | undefined,
    graphError: undefined as Error | undefined,
    rerankError: undefined as Error | undefined,
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
    resolveSkills: async () => {
      state.calls.push('resolve');
      return [];
    },
    searchGraph: async () => {
      state.calls.push('graph');
      if (state.graphError !== undefined) throw state.graphError;
      return [];
    },
    loadVacancies: async (ids) => state.rows.filter((row) => ids.includes(row.vacancy.id)),
    coverageFor: async () => new Map<string, number>(),
    explainVacancies: async () => new Map(),
    rerank: async () => {
      state.calls.push('rerank');
      if (state.rerankError !== undefined) throw state.rerankError;
      return [];
    },
  });
}

function loaded(id: string) {
  return { vacancy: vacancyDto(id), searchDocument: id, seniority: null };
}

function vacancyDto(id: string): VacancyDto {
  return {
    id,
    source: VacancySource.RabotaBy,
    language: Language.Ru,
    externalId: id,
    url: 'https://example.test',
    title: id,
    companyId: null,
    companyName: '',
    locationId: null,
    locationLabel: null,
    description: '',
    seniority: null,
    employment: null,
    workFormat: null,
    schedule: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryMinByn: null,
    salaryMaxByn: null,
    isGross: null,
    rateAmount: null,
    rateUnit: null,
    projectDurationDays: null,
    isForeignRemote: false,
    status: VacancyStatus.Active,
    publishedAt: '',
  };
}
