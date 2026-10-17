import type { SqlClient } from '../store/sql-client';
import type { EscoPlan, PlannedEdge, PlannedSkill } from './plan-esco';

/** Inserts a planned ESCO fixture. Occupations are not written. */
export async function importEscoPlan(client: SqlClient, plan: EscoPlan): Promise<void> {
  await client.query('BEGIN');
  try {
    for (const skill of plan.skills) await insertSkill(client, skill);
    for (const edge of plan.edges) await insertEdge(client, edge);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function insertSkill(client: SqlClient, skill: PlannedSkill): Promise<void> {
  const inserted = await client.query(
    `INSERT INTO skills (canonical_name, skill_type, esco_uri, needs_review)
     VALUES ($1, $2, $3, false)
     ON CONFLICT (canonical_name) DO UPDATE SET esco_uri = EXCLUDED.esco_uri
     RETURNING id`,
    [skill.canonicalName, skill.skillType, skill.escoUri],
  );
  const skillId = Number(inserted.rows[0]?.id);
  for (const alias of skill.aliases) {
    await client.query(
      `INSERT INTO skill_aliases (skill_id, alias, lang, source)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (alias, lang) DO NOTHING`,
      [skillId, alias.alias, alias.lang, alias.source],
    );
  }
}

async function insertEdge(client: SqlClient, edge: PlannedEdge): Promise<void> {
  await client.query(
    `INSERT INTO skill_edges (source_skill_id, target_skill_id, edge_type, weight, evidence)
     SELECT source.id, target.id, $3, $4, $5
     FROM skills source, skills target
     WHERE source.esco_uri = $1 AND target.esco_uri = $2
     ON CONFLICT DO NOTHING`,
    [edge.sourceUri, edge.targetUri, edge.edgeType, edge.weight, edge.evidence],
  );
}
