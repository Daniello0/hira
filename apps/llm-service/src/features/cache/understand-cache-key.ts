import { createHash } from 'node:crypto';
import type { UnderstandRequest } from '@hira/contracts';
import { isRecord } from '../../common/utils/is-record';
import { UNDERSTAND_CACHE_PREFIX } from '../llm/llm.constants';

/** Stable cache key for one understand input. Array order is part of the key. */
export function understandCacheKey(
  model: string,
  schemaVersion: string,
  request: UnderstandRequest,
): string {
  const payload = canonicalJson({ model, schemaVersion, request });
  const hash = createHash('sha256').update(payload).digest('hex');
  return `${UNDERSTAND_CACHE_PREFIX}${hash}`;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isRecord(value)) return value;
  return sortObject(value);
}

function sortObject(value: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
    sorted[key] = sortValue(value[key]);
  }
  return sorted;
}
