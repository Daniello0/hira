import { IngestionStatus, VacancySource } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import type { HttpGet } from '../connectors/collect-source';
import { JOB_INCREMENTAL } from '../ingestion.constants';
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
  const list = [
    card('55', 'Backend'),
    card('56', 'Frontend'),
  ].join('');
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
