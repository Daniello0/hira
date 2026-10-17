import type { SqlClient } from '../store/sql-client';

export interface UnembeddedSkill {
  id: string;
  name: string;
}

/** Skill nodes that still have no vector. */
export async function listUnembeddedSkills(
  client: SqlClient,
  limit: number,
): Promise<UnembeddedSkill[]> {
  const result = await client.query(
    `SELECT id::text AS id, canonical_name AS name
     FROM skills WHERE embedding IS NULL ORDER BY id LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({ id: String(row.id), name: String(row.name) }));
}
