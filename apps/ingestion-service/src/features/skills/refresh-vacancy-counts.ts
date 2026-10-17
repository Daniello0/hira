import type { SqlClient } from '../store/sql-client';

/** Recounts `skills.vacancy_count` from `vacancy_skills`. IDF and edges stay untouched. */
export async function refreshVacancyCounts(client: SqlClient): Promise<void> {
  await client.query(`UPDATE skills SET vacancy_count = 0`);
  await client.query(`UPDATE skills s SET vacancy_count = c.n
    FROM (
      SELECT skill_id, COUNT(DISTINCT vacancy_id)::int AS n
      FROM vacancy_skills GROUP BY skill_id
    ) c
    WHERE s.id = c.skill_id`);
}
