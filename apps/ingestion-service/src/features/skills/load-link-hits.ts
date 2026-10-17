import { TRIGRAM_MATCH_THRESHOLD, VECTOR_MATCH_THRESHOLD } from '../ingestion.constants';
import type { SqlClient } from '../store/sql-client';
import type { LinkHit } from './link-surface';

/** Loads cascade scores for one surface. A null vector skips the cosine step. */
export async function loadLinkHits(
  client: SqlClient,
  surface: string,
  vector: string | null,
): Promise<LinkHit[]> {
  if (surface.trim().length === 0) return [];
  const result = await client.query(HITS_SQL, [surface.trim(), vector]);
  return result.rows.map(readHit);
}

function readHit(row: Record<string, unknown>): LinkHit {
  return {
    skillId: Number(row.skillId),
    exactName: row.exactName === true,
    exactAlias: row.exactAlias === true,
    trigram: Number(row.trigram),
    cosine: Number(row.cosine),
  };
}

const HITS_SQL = `SELECT s.id AS "skillId",
  lower(trim(s.canonical_name)) = lower(trim($1)) AS "exactName",
  EXISTS (
    SELECT 1 FROM skill_aliases a
    WHERE a.skill_id = s.id AND lower(trim(a.alias)) = lower(trim($1))
  ) AS "exactAlias",
  GREATEST(
    similarity(s.canonical_name, $1),
    COALESCE((SELECT MAX(similarity(a.alias, $1)) FROM skill_aliases a WHERE a.skill_id = s.id), 0)
  ) AS trigram,
  CASE
    WHEN $2::vector IS NULL OR s.embedding IS NULL THEN 0
    ELSE 1 - (s.embedding <=> $2::vector)
  END AS cosine
  FROM skills s
  WHERE lower(trim(s.canonical_name)) = lower(trim($1))
     OR EXISTS (
       SELECT 1 FROM skill_aliases a
       WHERE a.skill_id = s.id AND lower(trim(a.alias)) = lower(trim($1))
     )
     OR similarity(s.canonical_name, $1) >= ${TRIGRAM_MATCH_THRESHOLD}
     OR COALESCE((SELECT MAX(similarity(a.alias, $1)) FROM skill_aliases a WHERE a.skill_id = s.id), 0)
          >= ${TRIGRAM_MATCH_THRESHOLD}
     OR (
       $2::vector IS NOT NULL AND s.embedding IS NOT NULL
       AND 1 - (s.embedding <=> $2::vector) >= ${VECTOR_MATCH_THRESHOLD}
     )`;
