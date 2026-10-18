/** Public search page size. Matches retrieval-service `DEFAULT_RESULT_LIMIT`. */
export const DEFAULT_SEARCH_LIMIT = 10;

/** Public search page size. Matches retrieval-service `MAX_RESULT_LIMIT`. */
export const MAX_SEARCH_LIMIT = 50;

/** core-api → llm-service. Wiki/01-architecture.md §5. */
export const LLM_TIMEOUT_MS = 25_000;

/**
 * core-api → retrieval-service.
 * Longer than the 10 s row in Wiki/01: a CPU rerank of the top 20 needs the headroom (stage 11 plan, question 3).
 */
export const RETRIEVAL_TIMEOUT_MS = 150_000;

export const DEFAULT_RETRIEVAL_URL = 'http://127.0.0.1:4001';
export const DEFAULT_LLM_URL = 'http://127.0.0.1:4002';

export const LLM_GATEWAY = Symbol('LLM_GATEWAY');
export const RETRIEVAL_GATEWAY = Symbol('RETRIEVAL_GATEWAY');
