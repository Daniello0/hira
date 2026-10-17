import { IngestionStatus, VacancySource, VacancyStatus } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import type { HttpGet } from '../connectors/collect-source';
import { JOB_INCREMENTAL, JOB_LIVENESS, LIVENESS_BATCH_SIZE } from '../ingestion.constants';
import { performIngest } from './perform-ingest';
import type { SqlClient } from './sql-client';

const ROBOTS = 'User-agent: *\nDisallow: *?*\n';
const LIST_HTML = `<article data-qa="vacancy-serp__vacancy"><a data-qa="serp-item__title" href="https://rabota.by/vacancy/55"><span data-qa="serp-item__title-text">Backend</span></a></article>`;
const DETAIL_HTML =
  '<h1 data-qa="vacancy-title">Backend</h1><div data-qa="vacancy-description"><p>Текст</p></div>';

describe('performIngest', () => {
  it('keeps the vacancy error instead of dropping it', async () => {
    const now = new Date('2026-10-17T12:00:00Z');
    const result = await performIngest({
      job: { source: VacancySource.RabotaBy, jobType: JOB_INCREMENTAL },
      client: failingClient(),
      http: rabotaHttp(),
      rates: {},
      rateError: null,
      limit: 5,
      now,
      pause: async () => undefined,
    });
    expect(result.status).toBe(IngestionStatus.Partial);
    expect(result.fetched).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual([{ externalId: '55', message: 'db down' }]);
    expect(result.finishedAt).toBe(now);
  });

  it('records a missing card and still writes the others', async () => {
    const now = new Date('2026-10-17T12:00:00Z');
    const result = await performIngest({
      job: { source: VacancySource.RabotaBy, jobType: JOB_INCREMENTAL },
      client: failingClient(),
      http: twoCardHttp(),
      rates: {},
      rateError: null,
      limit: 5,
      now,
      pause: async () => undefined,
    });
    expect(result.status).toBe(IngestionStatus.Partial);
    expect(result.fetched).toBe(2);
    expect(result.failed).toBe(2);
    expect(result.errors).toEqual([
      { externalId: '55', message: 'db down' },
      { externalId: '56', message: expect.stringMatching(/404/) },
    ]);
  });

  it('keeps a missing NBRB rate on the run', async () => {
    const now = new Date('2026-10-17T12:00:00Z');
    const result = await performIngest({
      job: { source: VacancySource.RabotaBy, jobType: JOB_INCREMENTAL },
      client: failingClient(),
      http: rabotaHttp(),
      rates: {},
      rateError: 'NBRB HTTP 503',
      limit: 0,
      now,
      pause: async () => undefined,
    });
    expect(result.failed).toBe(0);
    expect(result.status).toBe(IngestionStatus.Partial);
    expect(result.errors).toEqual([{ message: 'NBRB HTTP 503' }]);
  });
});

describe('liveness', () => {
  it('refreshes an open page, closes an archive, and expires a missing page', async () => {
    const calls: SqlCall[] = [];
    const now = new Date('2026-10-17T03:00:00Z');
    let pauses = 0;
    const result = await performIngest({
      job: { source: VacancySource.RabotaBy, jobType: JOB_LIVENESS },
      client: activeClient(calls, ['55', '56', '57']),
      http: livenessHttp(),
      rates: {},
      rateError: null,
      limit: 5,
      now,
      pause: async () => {
        pauses += 1;
      },
    });
    expect(result.status).toBe(IngestionStatus.Success);
    expect(result.fetched).toBe(3);
    expect(result.updated).toBe(3);
    expect(result.failed).toBe(0);
    expect(calls.some((call) => call.sql.includes('last_seen_at <'))).toBe(false);
    expect(writtenStatus(calls, '55', ['55', '56', '57'])).toBeUndefined();
    expect(writtenStatus(calls, '56', ['55', '56', '57'])).toBe(VacancyStatus.Closed);
    expect(writtenStatus(calls, '57', ['55', '56', '57'])).toBe(VacancyStatus.Expired);
    expect(pauses).toBe(3);
  });

  it('records a transport error and does not expire that vacancy', async () => {
    const calls: SqlCall[] = [];
    const result = await performIngest({
      job: { source: VacancySource.RabotaBy, jobType: JOB_LIVENESS },
      client: activeClient(calls, ['55']),
      http: {
        get: async (url) => {
          if (url.endsWith('/robots.txt'))
            return { status: 200, body: 'User-agent: *\nAllow: /\n' };
          return { status: 500, body: 'down' };
        },
      },
      rates: {},
      rateError: null,
      limit: 1,
      now: new Date('2026-10-17T03:00:00Z'),
      pause: async () => undefined,
    });
    expect(result.status).toBe(IngestionStatus.Partial);
    expect(result.failed).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.errors).toEqual([{ externalId: '55', message: expect.stringMatching(/500/) }]);
    expect(calls.some((call) => call.sql.includes(VacancyStatus.Expired))).toBe(false);
  });

  it('does not expire vacancies when robots.txt blocks the detail page', async () => {
    const calls: SqlCall[] = [];
    await expect(
      performIngest({
        job: { source: VacancySource.RabotaBy, jobType: JOB_LIVENESS },
        client: activeClient(calls, ['55']),
        http: {
          get: async () => ({ status: 200, body: 'User-agent: *\nDisallow: /\n' }),
        },
        rates: {},
        rateError: null,
        limit: 1,
        now: new Date('2026-10-17T03:00:00Z'),
        pause: async () => undefined,
      }),
    ).rejects.toThrow(/robots/i);
    expect(calls.some((call) => call.sql.includes('EXPIRED'))).toBe(false);
  });

  it('loads the next batch after a full page of active vacancies', async () => {
    const calls: SqlCall[] = [];
    await performIngest({
      job: { source: VacancySource.RabotaBy, jobType: JOB_LIVENESS },
      client: activeClient(
        calls,
        Array.from({ length: LIVENESS_BATCH_SIZE }, (_, index) => String(index + 1)),
      ),
      http: {
        get: async (url) => {
          if (url.endsWith('/robots.txt'))
            return { status: 200, body: 'User-agent: *\nAllow: /\n' };
          return { status: 200, body: '<h1>open</h1>' };
        },
      },
      rates: {},
      rateError: null,
      limit: 1,
      now: new Date('2026-10-17T03:00:00Z'),
      pause: async () => undefined,
    });
    expect(calls.filter((call) => call.sql.includes("status = 'ACTIVE'"))).toHaveLength(2);
  });
});

function livenessHttp(): HttpGet {
  return {
    get: async (url) => {
      if (url.endsWith('/robots.txt')) return { status: 200, body: 'User-agent: *\nAllow: /\n' };
      if (url.endsWith('/vacancy/56')) {
        return { status: 200, body: '<div data-qa="vacancy-title-archived-text">В архиве</div>' };
      }
      if (url.endsWith('/vacancy/57')) return { status: 404, body: 'missing' };
      return { status: 200, body: '<h1 data-qa="vacancy-title">Backend</h1>' };
    },
  };
}

interface SqlCall {
  sql: string;
  params: unknown[];
}

function activeClient(calls: SqlCall[], externalIds: string[]): SqlClient {
  const ids = new Map(externalIds.map((externalId, index) => [externalId, vacancyId(index + 1)]));
  let listed = false;
  return {
    query: async (sql, params = []) => {
      calls.push({ sql, params: [...params] });
      if (!sql.includes("status = 'ACTIVE'")) return { rows: [], rowCount: 1 };
      if (listed) return { rows: [] };
      listed = true;
      return {
        rows: externalIds.map((externalId) => ({
          id: ids.get(externalId),
          externalId,
        })),
      };
    },
  };
}

function writtenStatus(
  calls: SqlCall[],
  externalId: string,
  externalIds: string[],
): string | undefined {
  const id = vacancyId(externalIds.indexOf(externalId) + 1);
  const update = calls.find((call) => call.sql.includes('SET status') && call.params[0] === id);
  return typeof update?.params[1] === 'string' ? update.params[1] : undefined;
}

function vacancyId(index: number): string {
  return `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`;
}

function rabotaHttp(): HttpGet {
  return {
    get: async (url) => {
      if (url.endsWith('/robots.txt')) return { status: 200, body: ROBOTS };
      if (url.endsWith('/vacancy/55')) return { status: 200, body: DETAIL_HTML };
      return { status: 200, body: LIST_HTML };
    },
  };
}

function twoCardHttp(): HttpGet {
  const list = [card('55', 'Backend'), card('56', 'Frontend')].join('');
  return {
    get: async (url) => {
      if (url.endsWith('/robots.txt')) return { status: 200, body: ROBOTS };
      if (url.endsWith('/vacancy/56')) return { status: 404, body: 'missing' };
      if (url.endsWith('/vacancy/55')) return { status: 200, body: DETAIL_HTML };
      return { status: 200, body: list };
    },
  };
}

function card(externalId: string, title: string): string {
  return `<article data-qa="vacancy-serp__vacancy"><a data-qa="serp-item__title" href="https://rabota.by/vacancy/${externalId}"><span data-qa="serp-item__title-text">${title}</span></a></article>`;
}

function failingClient(): SqlClient {
  return {
    query: async () => {
      throw new Error('db down');
    },
  };
}
