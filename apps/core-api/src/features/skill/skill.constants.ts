/** Catalog autocomplete ignores a shorter query. */
export const SKILL_QUERY_MIN_LENGTH = 2;

/** How many catalog hits a combobox receives. */
export const SKILL_SEARCH_LIMIT = 20;

/** Trigram and exact-name search over `skills` and `skill_aliases`. */
export const SKILL_SEARCH_SQL = `SELECT s.id AS "skillId", s.canonical_name AS "canonicalName"
  FROM skills s
  WHERE lower(trim(s.canonical_name)) = lower(trim($1))
     OR EXISTS (
       SELECT 1 FROM skill_aliases a
       WHERE a.skill_id = s.id AND lower(trim(a.alias)) = lower(trim($1))
     )
     OR similarity(s.canonical_name, $1) >= $2
     OR COALESCE((
       SELECT MAX(similarity(a.alias, $1)) FROM skill_aliases a WHERE a.skill_id = s.id
     ), 0) >= $2
  ORDER BY (lower(trim(s.canonical_name)) = lower(trim($1))) DESC,
    GREATEST(
      similarity(s.canonical_name, $1),
      COALESCE((SELECT MAX(similarity(a.alias, $1)) FROM skill_aliases a WHERE a.skill_id = s.id), 0)
    ) DESC,
    s.id
  LIMIT ${SKILL_SEARCH_LIMIT}`;
