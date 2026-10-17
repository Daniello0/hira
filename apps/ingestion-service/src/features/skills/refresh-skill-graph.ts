import { NPMI_MIN_COOCCURRENCE, NPMI_MIN_WEIGHT } from './graph-stats';
import { refreshVacancyCounts } from './refresh-vacancy-counts';
import type { SqlClient } from '../store/sql-client';

/** Recounts vacancy_count, writes IDF, and replaces co-occurrence edges. */
export async function refreshSkillGraph(client: SqlClient): Promise<void> {
  await refreshVacancyCounts(client);
  await client.query(IDF_SQL);
  await client.query(
    `DELETE FROM skill_edges WHERE edge_type = 'RELATED_TO' AND evidence = 'COOCCURRENCE'`,
  );
  await client.query(EDGE_SQL, [NPMI_MIN_COOCCURRENCE, NPMI_MIN_WEIGHT]);
}

const IDF_SQL = `UPDATE skills s
  SET idf = CASE
    WHEN s.vacancy_count <= 0 OR corpus.n <= 0 OR s.vacancy_count::float >= corpus.n THEN 0
    ELSE ln(corpus.n / s.vacancy_count::float)
  END
  FROM (SELECT COUNT(DISTINCT vacancy_id)::float AS n FROM vacancy_skills) corpus`;

const EDGE_SQL = `WITH corpus AS (
    SELECT COUNT(DISTINCT vacancy_id)::float AS n FROM vacancy_skills
  ),
  pairs AS (
    SELECT left_skill.skill_id AS a, right_skill.skill_id AS b,
      COUNT(DISTINCT left_skill.vacancy_id)::float AS co
    FROM vacancy_skills left_skill
    JOIN vacancy_skills right_skill
      ON right_skill.vacancy_id = left_skill.vacancy_id
     AND right_skill.skill_id > left_skill.skill_id
    GROUP BY left_skill.skill_id, right_skill.skill_id
    HAVING COUNT(DISTINCT left_skill.vacancy_id) >= $1
  ),
  scored AS (
    SELECT pairs.a, pairs.b,
      ln((pairs.co / corpus.n) / ((left_count.n / corpus.n) * (right_count.n / corpus.n)))
        / (-ln(pairs.co / corpus.n)) AS weight
    FROM pairs
    JOIN corpus ON corpus.n > 0
    JOIN (
      SELECT skill_id, COUNT(DISTINCT vacancy_id)::float AS n
      FROM vacancy_skills GROUP BY skill_id
    ) left_count ON left_count.skill_id = pairs.a
    JOIN (
      SELECT skill_id, COUNT(DISTINCT vacancy_id)::float AS n
      FROM vacancy_skills GROUP BY skill_id
    ) right_count ON right_count.skill_id = pairs.b
  )
  INSERT INTO skill_edges (source_skill_id, target_skill_id, edge_type, weight, evidence)
  SELECT scored.a, scored.b, 'RELATED_TO'::skill_edge_type, LEAST(scored.weight, 1), 'COOCCURRENCE'
  FROM scored WHERE scored.weight >= $2
  UNION ALL
  SELECT scored.b, scored.a, 'RELATED_TO'::skill_edge_type, LEAST(scored.weight, 1), 'COOCCURRENCE'
  FROM scored WHERE scored.weight >= $2`;
