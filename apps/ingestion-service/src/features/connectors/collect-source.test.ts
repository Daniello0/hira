import { VacancySource } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { collectSource, shouldRetry, type HttpGet } from './collect-source';

const ROBOTS = 'User-agent: *\nDisallow: *?*\n';
const LIST_HTML = `<article data-qa="vacancy-serp__vacancy"><a data-qa="serp-item__title" href="https://rabota.by/vacancy/55?hhtmFrom=vacancy_search_list"><span data-qa="serp-item__title-text">Backend</span></a></article>`;
const DETAIL_HTML =
  '<h1 data-qa="vacancy-title">Backend</h1><div data-qa="vacancy-description"><p>Текст</p></div>';

function card(externalId: string, title: string): string {
  return `<article data-qa="vacancy-serp__vacancy"><a data-qa="serp-item__title" href="https://rabota.by/vacancy/${externalId}"><span data-qa="serp-item__title-text">${title}</span></a></article>`;
}

describe('collectSource', () => {
  it('loads a rabota.by page after the list and does not retry a 404', async () => {
    const urls: string[] = [];
    const accepts: string[] = [];
    let pauses = 0;
    const http: HttpGet = {
      get: async (url, headers) => {
        urls.push(url);
        accepts.push(headers.Accept);
        if (url.endsWith('/robots.txt')) return { status: 200, body: ROBOTS };
        if (url.endsWith('/vacancy/55')) return { status: 200, body: DETAIL_HTML };
        return { status: 200, body: LIST_HTML };
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
    expect(urls).toContain('https://rabota.by/search/vacancy');
    expect(urls).toContain('https://rabota.by/vacancy/55');
    expect(urls.some((url) => url.includes('api.hh.ru') || url.includes('?'))).toBe(false);
    expect(accepts.every((value) => value === 'text/html')).toBe(true);
    expect(pauses).toBe(2);
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

  it('surfaces a forbidden search page and does not call the API', async () => {
    const urls: string[] = [];
    const http: HttpGet = {
      get: async (url) => {
        urls.push(url);
        if (url.endsWith('/robots.txt')) return { status: 200, body: ROBOTS };
        return { status: 403, body: '{"errors":[{"type":"forbidden"}]}' };
      },
    };
    await expect(
      collectSource(VacancySource.RabotaBy, { http, limit: 1, pause: async () => undefined }),
    ).rejects.toThrow(/forbidden/);
    expect(urls.some((url) => url.includes('api.hh.ru'))).toBe(false);
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

  it('keeps the other cards when one detail page is missing', async () => {
    const list = [card('55', 'Backend'), card('56', 'Frontend')].join('');
    const http: HttpGet = {
      get: async (url) => {
        if (url.endsWith('/robots.txt')) return { status: 200, body: ROBOTS };
        if (url.endsWith('/vacancy/56')) return { status: 404, body: 'missing' };
        if (url.endsWith('/vacancy/55')) return { status: 200, body: DETAIL_HTML };
        return { status: 200, body: list };
      },
    };
    const result = await collectSource(VacancySource.RabotaBy, {
      http,
      limit: 5,
      pause: async () => undefined,
    });
    expect(result.raws.map((row) => row.externalId)).toEqual(['55']);
    expect(result.failures).toEqual([{ externalId: '56', message: expect.stringMatching(/404/) }]);
  });

  it('keeps the Habr card city when the detail page has none', async () => {
    const list = `<div class="vacancy-card "><a class="vacancy-card__title-link" href="/vacancies/9">Backend</a><svg class="svg-icon svg-icon--icon-placemark"></svg><div class="chip-with-icon__text">Самара</div></div>`;
    const detail = `<h1 class="page-title__title">Backend</h1><div class="vacancy-description__text"><div><p>Текст</p></div></div>`;
    const http: HttpGet = {
      get: async (url) => {
        if (url.endsWith('/robots.txt')) return { status: 200, body: 'User-agent: *\nAllow: /\n' };
        if (url.endsWith('/vacancies/9')) return { status: 200, body: detail };
        return { status: 200, body: list };
      },
    };
    const result = await collectSource(VacancySource.HabrCareer, {
      http,
      limit: 1,
      pause: async () => undefined,
    });
    expect(result.raws.map((row) => row.city)).toEqual(['Самара']);
    expect(result.raws.map((row) => row.region)).toEqual([null]);
  });

  it('rejects a source that belongs to a later stage', async () => {
    const http: HttpGet = { get: async () => ({ status: 200, body: '' }) };
    await expect(collectSource(VacancySource.LinkedIn, { http, limit: 1 })).rejects.toThrow(
      /stage 7/i,
    );
  });
});
