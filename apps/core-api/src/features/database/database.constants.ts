/** BGE-M3 dense width. Every embedding column uses this size. */
export const EMBEDDING_DIMENSION = 1024;

/** HNSW graph degree from Wiki/04-data-model.md. */
export const HNSW_M = 16;

/** HNSW build-time search depth from Wiki/04-data-model.md. */
export const HNSW_EF_CONSTRUCTION = 64;

/**
 * Row-local lexical document. Empty fragments are omitted.
 * Language is not part of the expression: each language has its own BM25 index (ADR-030).
 */
export const SEARCH_DOCUMENT_EXPRESSION = [
  "title || CASE WHEN skills_text <> '' THEN E'\\n' || skills_text ELSE '' END",
  " || CASE WHEN company_name <> '' THEN E'\\n' || company_name ELSE '' END",
  " || CASE WHEN description IS NOT NULL AND description <> '' THEN E'\\n' || description ELSE '' END",
].join('');

/** Tables in foreign-key order. The schema test compares the set, not this order. */
export const DATABASE_TABLES = [
  'industries',
  'locations',
  'users',
  'refresh_tokens',
  'companies',
  'vacancies',
  'vacancy_chunks',
  'vacancy_duplicates',
  'skills',
  'skill_aliases',
  'skill_edges',
  'vacancy_skills',
  'occupations',
  'occupation_skills',
  'occupation_transitions',
  'user_profiles',
  'user_profile_skills',
  'chats',
  'messages',
  'user_memories',
  'user_documents',
  'message_vacancies',
  'call_sessions',
  'call_turns',
  'collections',
  'favorites',
  'search_logs',
  'ingestion_runs',
  'feedback',
] as const;
