import { IntentType, QueryComplexity, type SearchIntent } from '@hira/contracts';
import { GREETING_MAX_WORDS, JOB_KEYWORDS } from './search.constants';

/**
 * Intent used when llm-service cannot understand the query.
 * The raw text becomes `rewrittenQuery` and no structural constraint is invented.
 * A short message with no job words is treated as small talk, so it neither searches nor spends quota.
 */
export function heuristicIntent(query: string): SearchIntent {
  return {
    rewrittenQuery: query.trim(),
    role: null,
    skills: [],
    seniority: null,
    hardConstraints: {},
    softConstraints: {},
    complexity: QueryComplexity.Simple,
    intentType: looksLikeGreeting(query) ? IntentType.SmallTalk : IntentType.Search,
  };
}

/** Short and free of job vocabulary, such as "hi" or "спасибо!". */
export function looksLikeGreeting(text: string): boolean {
  const lower = text.trim().toLowerCase();
  const words = lower.split(/\s+/u).filter((word) => word.length > 0);
  if (words.length === 0 || words.length > GREETING_MAX_WORDS) return false;
  if (/\d/u.test(lower)) return false;
  return !JOB_KEYWORDS.some((keyword) => lower.includes(keyword));
}
