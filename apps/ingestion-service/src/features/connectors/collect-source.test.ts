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
      pause: async () => undefined,
    });
    expect(result.truncated).toBe(false);
    expect(result.raws.map((row) => row.externalId)).toEqual(['55']);
    expect(urls.some((url) => url.includes('area=16'))).toBe(true);
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

  it('rejects a source that belongs to a later stage', async () => {
    const http: HttpGet = { get: async () => ({ status: 200, body: '' }) };
    await expect(collectSource(VacancySource.LinkedIn, { http, limit: 1 })).rejects.toThrow(
      /stage 7/i,
    );
  });
});
