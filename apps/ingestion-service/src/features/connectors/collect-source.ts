import { VacancySource } from '@hira/contracts';
import { HH_USER_AGENT } from '../ingestion.constants';
import type { RawVacancy } from './raw-vacancy';
import { parseRabotaList, parseRabotaVacancy } from './rabota/parse-rabota';
import { isRecord } from './record';
import { isFetchAllowed } from './robots';
import { gszVacancyPath, parseGszList, parseGszVacancy } from './gsz/parse-gsz';
import { parseHabrList, parseHabrVacancy } from './habr/parse-habr';

const RABOTA_ORIGIN = 'https://rabota.by';
const RABOTA_LIST_PATH = '/search/vacancy';
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

export interface CollectFailure {
  externalId: string;
  message: string;
}

export interface CollectResult {
  raws: RawVacancy[];
  truncated: boolean;
  failures: CollectFailure[];
}

/** Fetches one stage-7 source. HTML sources stop when robots.txt forbids the path. */
export async function collectSource(
  source: VacancySource,
  input: CollectInput,
): Promise<CollectResult> {
  const paced = paceRequests(input);
  if (source === VacancySource.RabotaBy) return collectRabota(paced);
  if (source === VacancySource.Gsz) return collectGsz(paced);
  if (source === VacancySource.HabrCareer) return collectHabr(paced);
  throw new Error(`source ${source} is outside stage 7`);
}

/** Retries once on 429 and 503. Other errors are not retried. */
export function shouldRetry(status: number, attempt: number): boolean {
  return attempt === 0 && (status === 429 || status === 503);
}

async function collectRabota(input: CollectInput): Promise<CollectResult> {
  await assertRobots(input, RABOTA_ORIGIN, RABOTA_LIST_PATH);
  const html = await readText(input, `${RABOTA_ORIGIN}${RABOTA_LIST_PATH}`);
  return details(input, parseRabotaList(html), RABOTA_ORIGIN, (item) => ({
    path: item.path,
    parse: (page) => parseRabotaVacancy(page, item.externalId),
  }));
}

async function collectGsz(input: CollectInput): Promise<CollectResult> {
  await assertRobots(input, GSZ_ORIGIN, GSZ_LIST_PATH);
  const html = await readText(input, `${GSZ_ORIGIN}${GSZ_LIST_PATH}`);
  return details(input, parseGszList(html), GSZ_ORIGIN, (item) => ({
    path: item.path,
    parse: (page) => parseGszVacancy(page, item.externalId),
  }));
}

async function collectHabr(input: CollectInput): Promise<CollectResult> {
  await assertRobots(input, HABR_ORIGIN, '/vacancies');
  const html = await readText(input, `${HABR_ORIGIN}${HABR_LIST_PATH}`);
  return details(input, parseHabrList(html), HABR_ORIGIN, (item) => ({
    path: `/vacancies/${item.externalId}`,
    parse: (page) => withCardCity(parseHabrVacancy(page, item.externalId), item.city),
  }));
}

function withCardCity(raw: RawVacancy, city: string | null): RawVacancy {
  if (raw.city !== null) return raw;
  return { ...raw, city };
}

async function details<T extends { externalId: string }>(
  input: CollectInput,
  items: T[],
  origin: string,
  toPage: (item: T) => { path: string; parse: (html: string) => RawVacancy },
): Promise<CollectResult> {
  const raws: RawVacancy[] = [];
  const failures: CollectFailure[] = [];
  for (const item of items.slice(0, input.limit)) {
    await readDetail(input, origin, item.externalId, toPage(item), raws, failures);
  }
  return { raws, failures, truncated: items.length > input.limit };
}

async function readDetail(
  input: CollectInput,
  origin: string,
  externalId: string,
  page: { path: string; parse: (html: string) => RawVacancy },
  raws: RawVacancy[],
  failures: CollectFailure[],
): Promise<void> {
  try {
    raws.push(page.parse(await readText(input, `${origin}${page.path}`)));
  } catch (error) {
    failures.push({ externalId, message: messageOf(error) });
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'vacancy failed';
}

/** Refuses the fetch when robots.txt disallows the path. */
export async function assertRobots(
  input: CollectInput,
  origin: string,
  path: string,
): Promise<void> {
  const response = await input.http.get(`${origin}/robots.txt`, headers());
  const robots = response.status >= 400 ? null : response.body;
  if (!isFetchAllowed(robots, path)) throw new Error(`robots.txt blocks ${path}`);
}

/** One HTTP GET, including a single retry on 429 and 503. */
export async function readResponse(
  input: CollectInput,
  url: string,
): Promise<{ status: number; body: string }> {
  return readWithRetry(input, url, 0);
}

async function readText(input: CollectInput, url: string): Promise<string> {
  const response = await readResponse(input, url);
  if (response.status >= 400) throw new Error(failure(response.status, response.body, url));
  return response.body;
}

/** Detail page address for one external id. */
export function detailTarget(
  source: VacancySource,
  externalId: string,
): { origin: string; path: string } {
  if (source === VacancySource.RabotaBy)
    return { origin: RABOTA_ORIGIN, path: `/vacancy/${externalId}` };
  if (source === VacancySource.Gsz) return gszTarget(externalId);
  if (source === VacancySource.HabrCareer) {
    return { origin: HABR_ORIGIN, path: `/vacancies/${externalId}` };
  }
  throw new Error(`source ${source} is outside stage 7`);
}

function gszTarget(externalId: string): { origin: string; path: string } {
  return {
    origin: GSZ_ORIGIN,
    path: gszVacancyPath(externalId),
  };
}

/** Pauses before every request except the first. */
export function paceRequests(input: CollectInput): CollectInput {
  let first = true;
  return {
    ...input,
    http: {
      get: async (url, headers) => {
        if (!first) await (input.pause ?? wait)();
        first = false;
        return input.http.get(url, headers);
      },
    },
  };
}

function failure(status: number, body: string, url: string): string {
  const type = upstreamType(body);
  const reason = type === null ? `HTTP ${status}` : `HTTP ${status} ${type}`;
  return `${reason} for ${url}`;
}

function upstreamType(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.errors)) return null;
    const first = parsed.errors[0];
    return isRecord(first) && typeof first.type === 'string' ? first.type : null;
  } catch {
    return null;
  }
}

async function readWithRetry(input: CollectInput, url: string, attempt: number) {
  const response = await input.http.get(url, headers());
  if (!shouldRetry(response.status, attempt)) return response;
  await (input.pause ?? wait)();
  return readWithRetry(input, url, attempt + 1);
}

function headers(): Record<string, string> {
  return { 'User-Agent': HH_USER_AGENT, Accept: 'text/html' };
}

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2000));
}
