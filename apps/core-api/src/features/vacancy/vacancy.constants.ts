/** Similar vacancies returned when the query has no `limit`. */
export const DEFAULT_SIMILAR_LIMIT = 10;

/** Largest `limit` for similar vacancies. Matches retrieval `MAX_RESULT_LIMIT`. */
export const MAX_SIMILAR_LIMIT = 50;

export const SIMILAR_LIMIT_MESSAGE = `limit must be an integer from 1 to ${MAX_SIMILAR_LIMIT}`;
