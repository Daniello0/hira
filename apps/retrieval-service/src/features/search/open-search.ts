import type { Pool } from 'pg';
import { ENV } from '../../common/constants/app.constants';
import { searchBm25 } from '../lexical/bm25-search';
import { EmbedQueryError, embedQuery, type EmbedPost } from '../dense/embed-query';
import { searchDense } from '../dense/hnsw-search';
import type { BranchSearch } from './run-branches';
import type { SearchPorts } from './run-search';
import { withClient } from './with-client';

/** Read-only search bound to Postgres and the encoder. No database URL means no route. */
export function openSearch(pool: Pool, env: NodeJS.ProcessEnv): SearchPorts {
  const embedUrl = env[ENV.teiEmbedUrl]?.trim() ?? '';
  const rerankUrl = env[ENV.teiRerankUrl]?.trim() ?? '';
  return { ...branchPorts(pool, embedUrl), ...cardPorts(rerankUrl) };
}

function branchPorts(pool: Pool, embedUrl: string): BranchSearch {
  return {
    searchBm25: (query, filters) => withClient(pool, (client) => searchBm25(client, query, filters)),
    searchDense: (vector, filters) => withClient(pool, (client) => searchDense(client, vector, filters)),
    embedQuery: (text) => embedLive(embedUrl, text),
    resolveSkills: async () => [],
    searchGraph: async () => [],
  };
}

function cardPorts(rerankUrl: string): Omit<SearchPorts, keyof BranchSearch> {
  return {
    loadVacancies: async () => [],
    coverageFor: async () => new Map(),
    explainVacancies: async () => new Map(),
    rerank: (query, documents) => rerankLive(rerankUrl, query, documents),
  };
}

async function embedLive(baseUrl: string, text: string): Promise<number[]> {
  if (baseUrl.length === 0) throw new EmbedQueryError('TEI_EMBED_URL is not set');
  return embedQuery(livePost(), baseUrl, text);
}

async function rerankLive(_baseUrl: string, _query: string, _documents: readonly string[]): Promise<number[]> {
  return [];
}

function livePost(): EmbedPost {
  return {
    post: async (url, body) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`embed failed with status ${response.status}`);
      return response.json() as Promise<unknown>;
    },
  };
}
