import { IntentType, QueryComplexity, type SearchIntent } from '@hira/contracts';

/**
 * Intent used when llm-service cannot understand the query.
 * The raw text becomes `rewrittenQuery` and no structural constraint is invented.
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
    intentType: IntentType.Search,
  };
}
