import {
  EMBEDDING_DIMENSION,
  TEI_MODEL_PROBE_TIMEOUT_MS,
  TEI_PROBE_INPUT,
  TEI_PROBE_PASSAGE,
  TEI_PROBE_QUERY,
} from './health.constants';
import { hasRerankScore, readEmbeddingDimension } from './tei-response';

export interface JsonPost {
  post(url: string, body: unknown, timeoutMs: number): Promise<unknown | null>;
}

/** POSTs JSON. A transport error or a non-OK status is an absent body, not a throw. */
export async function postJson(
  url: string,
  payload: unknown,
  timeoutMs: number,
): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, jsonRequest(payload, controller.signal));
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** True when `/embed` returns one vector of the BGE-M3 width. */
export async function probeEmbedding(
  post: JsonPost,
  baseUrl: string | undefined,
): Promise<boolean> {
  const url = endpoint(baseUrl, 'embed');
  if (url === null) return false;
  const body = await post.post(
    url,
    { inputs: TEI_PROBE_INPUT, truncate: true },
    TEI_MODEL_PROBE_TIMEOUT_MS,
  );
  return readEmbeddingDimension(body) === EMBEDDING_DIMENSION;
}

/** True when `/rerank` returns a finite score for one passage. */
export async function probeRerank(post: JsonPost, baseUrl: string | undefined): Promise<boolean> {
  const url = endpoint(baseUrl, 'rerank');
  if (url === null) return false;
  const body = await post.post(url, rerankPayload(), TEI_MODEL_PROBE_TIMEOUT_MS);
  return hasRerankScore(body);
}

function jsonRequest(payload: unknown, signal: AbortSignal): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  };
}

function rerankPayload(): { query: string; texts: string[]; truncate: true } {
  return { query: TEI_PROBE_QUERY, texts: [TEI_PROBE_PASSAGE], truncate: true };
}

function endpoint(baseUrl: string | undefined, path: string): string | null {
  if (baseUrl === undefined || baseUrl.trim().length === 0) return null;
  return `${baseUrl.replace(/\/$/, '')}/${path}`;
}
