/** How many vacancies one branch may return. */
export const BRANCH_LIMIT = 100;

/** Furthest HNSW page while distinct vacancies are still below the branch limit. */
export const DENSE_PAGE_CAP = 400;

export const DEFAULT_RESULT_LIMIT = 10;
export const MAX_RESULT_LIMIT = 50;

export const BM25_INDEX_RU = 'idx_vac_bm25_ru';
export const BM25_INDEX_EN = 'idx_vac_bm25_en';

export const VALIDATION_FAILED_CODE = 'VALIDATION_FAILED';
export const VALIDATION_FAILED_MESSAGE = 'Search request is invalid';
export const RETRIEVAL_UNAVAILABLE_CODE = 'RETRIEVAL_UNAVAILABLE';
export const RETRIEVAL_UNAVAILABLE_MESSAGE = 'Retrieval branch failed';

export const EMBEDDING_WIDTH = 1024;
