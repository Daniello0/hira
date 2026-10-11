import { VacancySource } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { collectSource, shouldRetry, type HttpGet } from './collect-source';

const DETAIL = {
  id: '55',
  name: 'Backend',
  archived: false,
  alternate_url: 'https://rabota.by/vacancy/55',
  description: '<p>API</p>',
  area: { name: 'Минск' },
  employer: { name: 'ООО Рога' },
  salary: null,
  experience: { name: 'Нет опыта' },
  employment: { name: 'Полная занятость' },
  schedule: { name: 'Удаленная работа' },
};

describe('collectSource', () => {
  it('loads a HeadHunter detail after the list and does not retry a 404', async () => {
    const urls: string[] = [];
    let pauses = 0;
    const http: HttpGet = {
      get: async (url) => {
        urls.push(url);
        if (url.endsWith('/vacancies/55')) return { status: 200, body: JSON.stringify(DETAIL) };
        return { status: 200, body: JSON.stringify({ found: 1, pages: 1, items: [{ id: '55' }] }) };
      },
    };
    const result = await collectSource(VacancySource.RabotaBy, {
      http,
      limit: 5,
      pause: async () => {
        pauses += 1;
      },
    });
    expect(result.truncated).toBe(false);
    expect(result.raws.map((row) => row.externalId)).toEqual(['55']);
    expect(urls.some((url) => url.includes('area=16'))).toBe(true);
    expect(pauses).toBe(1);
    expect(shouldRetry(404, 0)).toBe(false);
    expect(shouldRetry(429, 0)).toBe(true);
    expect(shouldRetry(429, 1)).toBe(false);
  });

  it('does not download a page robots.txt forbids', async () => {
    const urls: string[] = [];
    const http: HttpGet = {
      get: async (url) => {
        urls.push(url);
        return { status: 200, body: 'User-agent: *\nDisallow: /vacancies\n' };
      },
    };
    await expect(
      collectSource(VacancySource.HabrCareer, { http, limit: 1, pause: async () => undefined }),
    ).rejects.toThrow(/robots/i);
    expect(urls).toEqual(['https://career.habr.com/robots.txt']);
  });

  it('pauses between HeadHunter requests and surfaces a forbidden body', async () => {
    let pauses = 0;
    const http: HttpGet = {
      get: async (url) => {
        if (url.endsWith('/vacancies/55')) return { status: 200, body: JSON.stringify(DETAIL) };
        if (url.includes('/vacancies?')) {
          return { status: 403, body: '{"errors":[{"type":"forbidden"}]}' };
        }
        return { status: 200, body: '' };
      },
    };
    await expect(
      collectSource(VacancySource.RabotaBy, {
        http,
        limit: 1,
        pause: async () => {
          pauses += 1;
        },
      }),
    ).rejects.toThrow(/forbidden/);
    expect(pauses).toBe(0);
  });

  it('asks GSZ for the detail href published on the card', async () => {
    const urls: string[] = [];
    const card = `<div class="job-block"><a href="/registration/employer/vacancy/449560/detail-public/?source=search" title="Инженер" class="debounced-link">Инженер</a></div>`;
    const http: HttpGet = {
      get: async (url) => {
        urls.push(url);
        if (url.endsWith('/robots.txt')) return { status: 200, body: 'User-agent: *\nAllow: /\n' };
        if (url.includes('detail-public')) return { status: 200, body: '<h1>Инженер</h1>' };
        return { status: 200, body: card };
      },
    };
    const result = await collectSource(VacancySource.Gsz, {
      http,
      limit: 1,
      pause: async () => undefined,
    });
    expect(result.raws.map((row) => row.title)).toEqual(['Инженер']);
    expect(urls.some((url) => url.includes('detail-public/?source=search'))).toBe(true);
  });

  it('rejects a source that belongs to a later stage', async () => {
    const http: HttpGet = { get: async () => ({ status: 200, body: '' }) };
    await expect(collectSource(VacancySource.LinkedIn, { http, limit: 1 })).rejects.toThrow(
      /stage 7/i,
    );
  });
});
