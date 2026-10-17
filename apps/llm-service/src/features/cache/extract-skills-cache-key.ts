import { createHash } from 'node:crypto';
import type { ExtractSkillsVacancy } from '@hira/contracts';
import { EXTRACT_SKILLS_CACHE_PREFIX } from '../llm/llm.constants';

/** Cache key for one vacancy text. The vacancy id is not part of the key. */
export function extractSkillsCacheKey(
  model: string,
  schemaVersion: string,
  vacancy: ExtractSkillsVacancy,
): string {
  const payload = JSON.stringify({
    model,
    schemaVersion,
    title: vacancy.title,
    description: vacancy.description,
  });
  const hash = createHash('sha256').update(payload).digest('hex');
  return `${EXTRACT_SKILLS_CACHE_PREFIX}${hash}`;
}
