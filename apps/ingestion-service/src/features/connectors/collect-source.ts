import { VacancySource } from '@hira/contracts';
import { HH_USER_AGENT } from '../ingestion.constants';
import type { RawVacancy } from './raw-vacancy';
import { buildHhListPath, hhListIsTruncated, parseHhList, parseHhVacancy } from './hh/parse-hh';
import { isFetchAllowed } from './robots';
import { parseGszList, parseGszVacancy } from './gsz/parse-gsz';
import { parseHabrList, parseHabrVacancy } from './habr/parse-habr';

const HH_ORIGIN = 'https://api.hh.ru';
const GSZ_ORIGIN = 'https://gsz.gov.by';
const HABR_ORIGIN = 'https://career.habr.com';
const GSZ_LIST_PATH = '/registration/vacancy-search/';
const HABR_LIST_PATH = '/vacancies?type=all';

export interface HttpGet {
  get(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }>;
}

export interface CollectInput {
  http: HttpGet;
  limit: number;
  pause?: () => Promise<void>;
}

export interface CollectResult {
  raws: RawVacancy[];
  truncated: boolean;
}

/** Fetches one stage-7 source. HTML sources stop when robots.txt forbids the path. */
export async function collectSource(
  source: VacancySource,
  input: CollectInput,
): Promise<CollectResult> {
  if (source === VacancySource.RabotaBy) return collectHh(input);
  if (source === VacancySource.Gsz) return collectGsz(input);
  if (source === VacancySource.HabrCareer) return collectHabr(input);
  throw new Error(`source ${source} is outside stage 7`);
}

/** Retries once on 429 and 503. Other errors are not retried. */
export function shouldRetry(status: number, attempt: number): boolean {
  return attempt === 0 && (status === 429 || status === 503);
}

async function collectHh(input: CollectInput): Promise<CollectResult> {
  const listUrl = `${HH_ORIGIN}${buildHhListPath({ page: 0 })}`;
  const list = parseHhList(await readJson(input, listUrl));
  const refs = list.refs.slice(0, input.limit);
  const raws: RawVacancy[] = [];
  for (const ref of refs) {
    raws.push(parseHhVacancy(await readJson(input, `${HH_ORIGIN}/vacancies/${ref.externalId}`)));
  }
  return { raws, truncated: hhListIsTruncated(list.found) };
}

async function collectGsz(input: CollectInput): Promise<CollectResult> {
  await assertRobots(input, GSZ_ORIGIN, GSZ_LIST_PATH);
  const html = await readText(input, `${GSZ_ORIGIN}${GSZ_LIST_PATH}`);
  return details(input, parseGszList(html), GSZ_ORIGIN, (item) => {
    const path = `/registration/employer/vacancy/${item.externalId}/detail-public/`;
    return { path, parse: (page) => parseGszVacancy(page, item.externalId) };
  });
}

async function collectHabr(input: CollectInput): Promise<CollectResult> {
  await assertRobots(input, HABR_ORIGIN, '/vacancies');
  const html = await readText(input, `${HABR_ORIGIN}${HABR_LIST_PATH}`);
  return details(input, parseHabrList(html), HABR_ORIGIN, (item) => {
    const path = `/vacancies/${item.externalId}`;
    return { path, parse: (page) => parseHabrVacancy(page, item.externalId) };
  });
}

async function details<T extends { externalId: string }>(
  input: CollectInput,
  items: T[],
  origin: string,
  toPage: (item: T) => { path: string; parse: (html: string) => RawVacancy },
): Promise<CollectResult> {
  const raws: RawVacancy[] = [];
  for (const item of items.slice(0, input.limit)) {
    const page = toPage(item);
    raws.push(page.parse(await readText(input, `${origin}${page.path}`)));
  }
  return { raws, truncated: items.length > input.limit };
}

async function assertRobots(input: CollectInput, origin: string, path: string): Promise<void> {
  const response = await input.http.get(`${origin}/robots.txt`, headers());
  const robots = response.status >= 400 ? null : response.body;
  if (!isFetchAllowed(robots, path)) throw new Error(`robots.txt blocks ${path}`);
}

async function readJson(input: CollectInput, url: string): Promise<unknown> {
  return JSON.parse(await readText(input, url));
}

async function readText(input: CollectInput, url: string): Promise<string> {
  const response = await readWithRetry(input, url, 0);
  if (response.status >= 400) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.body;
}

async function readWithRetry(input: CollectInput, url: string, attempt: number) {
  const response = await input.http.get(url, headers());
  if (!shouldRetry(response.status, attempt)) return response;
  await (input.pause ?? wait)();
  return readWithRetry(input, url, attempt + 1);
}

function headers(): Record<string, string> {
  return { 'User-Agent': HH_USER_AGENT, Accept: 'application/json, text/html' };
}

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2000));
}
