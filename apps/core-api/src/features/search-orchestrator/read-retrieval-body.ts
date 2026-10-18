import type { RetrievalOptions, RetrievalRequest, SearchIntent } from '@hira/contracts';
import { MAX_SEARCH_LIMIT } from './search.constants';

/** Reads `POST /api/v1/search`. A client-supplied `userId` is ignored. */
export function readRetrievalBody(body: unknown): RetrievalRequest | null {
  if (!isRecord(body) || !isRecord(body.intent)) return null;
  if (typeof body.intent.rewrittenQuery !== 'string' || body.intent.rewrittenQuery.trim().length === 0) return null;
  const limit = readLimit(body.limit);
  if (limit === 'invalid' || (body.options !== undefined && !isRecord(body.options))) return null;
  return {
    intent: body.intent as unknown as SearchIntent,
    ...(typeof limit === 'number' ? { limit } : { limit: undefined as unknown as number }),
    ...(body.options === undefined ? {} : { options: body.options as unknown as RetrievalOptions }),
  };
}

function readLimit(value: unknown): number | undefined | 'invalid' {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_SEARCH_LIMIT) {
    return 'invalid';
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
