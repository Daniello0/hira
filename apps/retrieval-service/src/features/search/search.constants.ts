import { QueryComplexity, RetrievalBranch, SkillEdgeType } from '@hira/contracts';

/** How many vacancies one branch may return. */
export const BRANCH_LIMIT = 100;

/** Furthest HNSW page while distinct vacancies are still below the branch limit. */
export const DENSE_PAGE_CAP = 400;

export const DEFAULT_RESULT_LIMIT = 10;
export const MAX_RESULT_LIMIT = 50;

export const BM25_INDEX_RU = 'idx_vac_bm25_ru';
export const BM25_INDEX_EN = 'idx_vac_bm25_en';

/** `users.id` is a uuid. Anything else must not reach `user_profile_skills.user_id`. */
export const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const VALIDATION_FAILED_CODE = 'VALIDATION_FAILED';
export const VALIDATION_FAILED_MESSAGE = 'Search request is invalid';
export const RETRIEVAL_UNAVAILABLE_CODE = 'RETRIEVAL_UNAVAILABLE';
export const RETRIEVAL_UNAVAILABLE_MESSAGE = 'Retrieval branch failed';

export const EMBEDDING_WIDTH = 1024;

/** RRF constant from Cormack et al. The rank is 1-based, so the denominator is 61 on the first hit. */
export const RRF_K = 60;

/** How many fused hits the production reranker scores. */
export const RERANK_WINDOW = 20;

/** Expanded skill nodes kept after the walk. */
export const GRAPH_NODE_CAP = 200;

/** A node at or below this weight stays in the set and does not grow children. */
export const GRAPH_WEIGHT_FLOOR = 0.25;

/** Highest hop written by the walk. The exit check is `hop < GRAPH_MAX_HOP`. */
export const GRAPH_MAX_HOP = 2;

/** Weight of a skill named by the query. */
export const SEED_WEIGHT = 1;

/** CPU rerank of the top 20 is a few seconds; a short timeout would treat that as failure. */
export const RERANK_TIMEOUT_MS = 120_000;

/** TEI `--max-batch-tokens` of the Compose reranker. */
export const RERANK_TOKEN_ARENA = 8192;

/** Rough token estimate: one token per four characters. */
export const CHARS_PER_TOKEN = 4;

/** Same cascade cutoffs as ingestion. Retrieval does not import that package. */
export const TRIGRAM_MATCH_THRESHOLD = 0.8;
export const VECTOR_MATCH_THRESHOLD = 0.85;

/** Per-edge decay. Other edge types are not walked. */
export const EDGE_DECAY = {
  [SkillEdgeType.AlternativeOf]: 1,
  [SkillEdgeType.Narrower]: 0.8,
  [SkillEdgeType.RelatedTo]: 0.6,
} as const;

/** Branch weights by query complexity. Values are the S2 table. */
export const COMPLEXITY_WEIGHTS: Record<QueryComplexity, Record<RetrievalBranch, number>> = {
  [QueryComplexity.Simple]: {
    [RetrievalBranch.Lexical]: 0.4,
    [RetrievalBranch.Dense]: 0.5,
    [RetrievalBranch.Graph]: 0.1,
  },
  [QueryComplexity.Moderate]: {
    [RetrievalBranch.Lexical]: 0.3,
    [RetrievalBranch.Dense]: 0.4,
    [RetrievalBranch.Graph]: 0.3,
  },
  [QueryComplexity.Complex]: {
    [RetrievalBranch.Lexical]: 0.2,
    [RetrievalBranch.Dense]: 0.35,
    [RetrievalBranch.Graph]: 0.45,
  },
  [QueryComplexity.Exploratory]: {
    [RetrievalBranch.Lexical]: 0.1,
    [RetrievalBranch.Dense]: 0.3,
    [RetrievalBranch.Graph]: 0.6,
  },
};
