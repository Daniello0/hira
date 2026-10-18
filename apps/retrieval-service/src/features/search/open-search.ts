import type { Pool } from 'pg';
import { ENV } from '../../common/constants/app.constants';
import { searchBm25 } from '../lexical/bm25-search';
import { EmbedQueryError, embedQuery, type EmbedPost } from '../dense/embed-query';
import { searchDense } from '../dense/hnsw-search';
import type { BranchSearch } from './run-branches';
import { withClient } from './with-client';

/** Read-only search bound to Postgres and the encoder. No database URL means no route. */
export function openSearch(pool: Pool, env: NodeJS.ProcessEnv): BranchSearch {
  const baseUrl = env[ENV.teiEmbedUrl]?.trim() ?? '';
  return {
    searchBm25: (query, filters) => withClient(pool, (client) => searchBm25(client, query, filters)),
    searchDense: (vector, filters) => withClient(pool, (client) => searchDense(client, vector, filters)),
    embedQuery: (text) => embedLive(baseUrl, text),
  };
}

async function embedLive(baseUrl: string, text: string): Promise<number[]> {
  if (baseUrl.length === 0) throw new EmbedQueryError('TEI_EMBED_URL is not set');
  return embedQuery(livePost(), baseUrl, text);
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
