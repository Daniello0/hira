import type { Pool } from 'pg';
import { ENV } from '../../common/constants/app.constants';
import { EmbedQueryError, embedQuery, embedTexts, type EmbedPost } from '../dense/embed-query';
import { searchDense } from '../dense/hnsw-search';
import { explainVacancies } from '../explain/explain-skills';
import { coverageFor, searchGraph } from '../graph/graph-search';
import { loadKnownIds, loadLinkHits, resolveQuerySkills } from '../graph/load-link-hits';
import { searchBm25 } from '../lexical/bm25-search';
import { rerankTexts, type RerankPost } from '../rerank/rerank-client';
import { loadVacancies } from './load-vacancy';
import type { BranchSearch } from './run-branches';
import type { SearchPorts } from './run-search';
import { withClient } from './with-client';

/** Read-only search bound to Postgres, the encoder, and the reranker. */
export function openSearch(pool: Pool, env: NodeJS.ProcessEnv): SearchPorts {
  const embedUrl = env[ENV.teiEmbedUrl]?.trim() ?? '';
  const rerankUrl = env[ENV.teiRerankUrl]?.trim() ?? '';
  return { ...branchPorts(pool, embedUrl), ...cardPorts(pool, rerankUrl) };
}

function branchPorts(pool: Pool, embedUrl: string): BranchSearch {
  return {
    searchBm25: (query, filters) =>
      withClient(pool, (client) => searchBm25(client, query, filters)),
    searchDense: (vector, filters) =>
      withClient(pool, (client) => searchDense(client, vector, filters)),
    embedQuery: (text) => embedLive(embedUrl, text),
    resolveSkills: (mentions) =>
      withClient(pool, (client) => resolveLive(client, embedUrl, mentions)),
    searchGraph: (ids, filters) => withClient(pool, (client) => searchGraph(client, ids, filters)),
  };
}

function cardPorts(pool: Pool, rerankUrl: string): Omit<SearchPorts, keyof BranchSearch> {
  return {
    loadVacancies: (ids) => withClient(pool, (client) => loadVacancies(client, ids)),
    coverageFor: (skillIds, vacancyIds) =>
      withClient(pool, (client) => coverageFor(client, skillIds, vacancyIds)),
    explainVacancies: (query) => withClient(pool, (client) => explainVacancies(client, query)),
    rerank: (query, documents) => rerankLive(rerankUrl, query, documents),
  };
}

async function resolveLive(
  client: Parameters<typeof loadKnownIds>[0],
  embedUrl: string,
  mentions: Parameters<typeof resolveQuerySkills>[0],
): Promise<Awaited<ReturnType<typeof resolveQuerySkills>>> {
  return resolveQuerySkills(mentions, {
    knownIds: (ids) => loadKnownIds(client, ids),
    hits: (surface, vector) => loadLinkHits(client, surface, vector),
    embed: (texts) => embedLiveTexts(embedUrl, texts),
  });
}

async function embedLive(baseUrl: string, text: string): Promise<number[]> {
  if (baseUrl.length === 0) throw new EmbedQueryError('TEI_EMBED_URL is not set');
  return embedQuery(livePost(), baseUrl, text);
}

async function embedLiveTexts(baseUrl: string, texts: readonly string[]): Promise<number[][]> {
  if (baseUrl.length === 0) throw new EmbedQueryError('TEI_EMBED_URL is not set');
  return embedTexts(livePost(), baseUrl, texts);
}

async function rerankLive(
  baseUrl: string,
  query: string,
  documents: readonly string[],
): Promise<number[]> {
  if (baseUrl.length === 0) throw new Error('TEI_RERANK_URL is not set');
  return rerankTexts(liveRerankPost(), baseUrl, query, documents);
}

function livePost(): EmbedPost {
  return { post: (url, body) => postJson(url, body) };
}

function liveRerankPost(): RerankPost {
  return { post: (url, body, timeoutMs) => postJson(url, body, timeoutMs) };
}

async function postJson(url: string, body: unknown, timeoutMs?: number): Promise<unknown> {
  const controller = new AbortController();
  const timer =
    timeoutMs === undefined ? undefined : setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`request failed with status ${response.status}`);
    return response.json() as Promise<unknown>;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
