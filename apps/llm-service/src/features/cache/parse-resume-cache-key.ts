import { createHash } from 'node:crypto';
import { PARSE_RESUME_CACHE_PREFIX } from '../llm/llm.constants';

/** Cache key for one resume text. The same text shares one entry across uploads. */
export function parseResumeCacheKey(model: string, schemaVersion: string, resumeText: string): string {
  const payload = JSON.stringify({ model, schemaVersion, resumeText });
  return `${PARSE_RESUME_CACHE_PREFIX}${createHash('sha256').update(payload).digest('hex')}`;
}
