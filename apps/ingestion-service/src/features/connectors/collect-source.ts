import type { VacancySource } from '@hira/contracts';
import { HH_USER_AGENT, MAX_LIST_PAGES, SOURCE_PAUSE_MS } from '../ingestion.constants';
import type { RawVacancy, RawVacancyRef } from './raw-vacancy';
import { isRecord } from './record';
import { connectorFor, disabledMessage, isSourceEnabled } from './registry';
import { isFetchAllowed } from './robots';
import type { PauseRange, VacancyConnector } from './vacancy-connector';

export interface HttpGet {
  get(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }>;
}

export interface CollectInput {
  http: HttpGet;
  limit: number;
  /** Overrides the connector's pause (tests pass a no-op). */
  pause?: () => Promise<void>;
  /** Asked before every request of a capped source; false stops the run early. */
  requestBudget?: () => Promise<boolean>;
  /** Source switches; defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
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

/** Thrown when a capped source used up its daily request budget. */
export class RequestCapReached extends Error {
  constructor() {
    super('daily request cap of the source is reached');
  }
}

/**
 * Reads list pages of every query until `limit` cards or no new cards, then each detail page.
 * Refuses a disabled source and a first list page that robots.txt forbids.
 */
export async function collectSource(
  source: VacancySource,
  input: CollectInput,
): Promise<CollectResult> {
  if (!isSourceEnabled(source, input.env ?? process.env)) {
    throw new Error(disabledMessage(source));
  }
  const connector = connectorFor(source);
  const paced = pacedFor(connector, input);
  const robots = await readRobots(paced, connector.origin);
  assertDetailPathAllowed(connector, robots);
  const listed = await collectRefs(connector, paced, robots);
  const details = await readDetails(connector, paced, listed.refs);
  return {
    raws: details.raws,
    failures: details.failures,
    truncated: listed.truncated || details.capped,
  };
}

/** Detail pages are read for every card, so a source whose robots.txt forbids them stops here. */
function assertDetailPathAllowed(connector: VacancyConnector, robots: string | null): void {
  const path = connector.detailPath(DETAIL_PROBE_ID);
  if (!isFetchAllowed(robots, path)) throw new Error(`robots.txt blocks ${path}`);
}

const DETAIL_PROBE_ID = '1';

/** Request pacing for one source: the connector's random pause unless the caller sets one. */
export function pacedFor(connector: VacancyConnector, input: CollectInput): CollectInput {
  return paceRequests({ ...input, pause: input.pause ?? randomPause(connector.pause) });
}

/** Retries once on 429 and 503. Other errors are not retried. */
export function shouldRetry(status: number, attempt: number): boolean {
  return attempt === 0 && (status === 429 || status === 503);
}

interface ListedRefs {
  refs: RawVacancyRef[];
  truncated: boolean;
}

async function collectRefs(
  connector: VacancyConnector,
  input: CollectInput,
  robots: string | null,
): Promise<ListedRefs> {
  const refs = new Map<string, RawVacancyRef>();
  let truncated = false;
  for (const [index, query] of connector.queries.entries()) {
    if (refs.size >= input.limit) return { refs: [...refs.values()], truncated: true };
    const walk = { connector, input, robots, query, first: index === 0 };
    truncated = (await collectQuery(walk, refs)) || truncated;
  }
  return { refs: [...refs.values()], truncated };
}

interface QueryWalk {
  connector: VacancyConnector;
  input: CollectInput;
  robots: string | null;
  query: string;
  first: boolean;
}

/** Reads the pages of one query. Returns true when cards were left unread. */
async function collectQuery(walk: QueryWalk, refs: Map<string, RawVacancyRef>): Promise<boolean> {
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const path = allowedListPath(walk, page);
    if (path === null) return false;
    const html = await readListPage(walk, path, page);
    if (html === null) return true;
    const fresh = walk.connector
      .parseList(html, walk.query)
      .filter((ref) => !refs.has(ref.externalId));
    if (fresh.length === 0) return false;
    if (addUpToLimit(refs, fresh, walk.input.limit)) return true;
  }
  return true;
}

function allowedListPath(walk: QueryWalk, page: number): string | null {
  const path = walk.connector.listPath(walk.query, page);
  if (path === null || isFetchAllowed(walk.robots, path)) return path;
  if (page === 0 && walk.first) throw new Error(`robots.txt blocks ${path}`);
  return null;
}

/** The first page must load; a later page that fails or hits the cap ends the query. */
async function readListPage(walk: QueryWalk, path: string, page: number): Promise<string | null> {
  const url = `${walk.connector.origin}${path}`;
  if (page === 0 && walk.first) return readText(walk.input, url);
  try {
    return await readText(walk.input, url);
  } catch {
    return null;
  }
}

/** Adds cards until the limit. Returns true when a card did not fit. */
function addUpToLimit(
  refs: Map<string, RawVacancyRef>,
  fresh: readonly RawVacancyRef[],
  limit: number,
): boolean {
  for (const ref of fresh) {
    if (refs.size >= limit) return true;
    refs.set(ref.externalId, ref);
  }
  return false;
}

interface DetailResult {
  raws: RawVacancy[];
  failures: CollectFailure[];
  capped: boolean;
}

async function readDetails(
  connector: VacancyConnector,
  input: CollectInput,
  refs: readonly RawVacancyRef[],
): Promise<DetailResult> {
  const result: DetailResult = { raws: [], failures: [], capped: false };
  for (const ref of refs) {
    try {
      const html = await readText(
        input,
        `${connector.origin}${connector.detailPath(ref.externalId)}`,
      );
      result.raws.push(connector.parseDetail(html, ref));
    } catch (error) {
      if (error instanceof RequestCapReached) return { ...result, capped: true };
      result.failures.push({ externalId: ref.externalId, message: messageOf(error) });
    }
  }
  return result;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'vacancy failed';
}

async function readRobots(input: CollectInput, origin: string): Promise<string | null> {
  const response = await input.http.get(`${origin}/robots.txt`, headers());
  return response.status >= 400 ? null : response.body;
}

/** Refuses the fetch when robots.txt disallows the path. */
export async function assertRobots(
  input: CollectInput,
  origin: string,
  path: string,
): Promise<void> {
  const robots = await readRobots(input, origin);
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
  const connector = connectorFor(source);
  return { origin: connector.origin, path: connector.detailPath(externalId) };
}

/** Pauses before every request except the first and spends the request budget, if any. */
export function paceRequests(input: CollectInput): CollectInput {
  let first = true;
  return {
    ...input,
    http: {
      get: async (url, requestHeaders) => {
        if (input.requestBudget !== undefined && !(await input.requestBudget())) {
          throw new RequestCapReached();
        }
        if (!first) await (input.pause ?? wait)();
        first = false;
        return input.http.get(url, requestHeaders);
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

async function readWithRetry(
  input: CollectInput,
  url: string,
  attempt: number,
): Promise<{ status: number; body: string }> {
  const response = await input.http.get(url, headers());
  if (!shouldRetry(response.status, attempt)) return response;
  await (input.pause ?? wait)();
  return readWithRetry(input, url, attempt + 1);
}

function headers(): Record<string, string> {
  return { 'User-Agent': HH_USER_AGENT, Accept: 'text/html' };
}

function randomPause(range: PauseRange): () => Promise<void> {
  return () => sleep(range.minMs + Math.random() * (range.maxMs - range.minMs));
}

function wait(): Promise<void> {
  return sleep(SOURCE_PAUSE_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
