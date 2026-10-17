import type { ExtractedSkill } from '@hira/contracts';
import { SkillAliasSource } from '@hira/contracts';
import type { SqlClient } from '../store/sql-client';

const ALIAS_LANG = 'ru';

/** Creates a review node for a surface the cascade could not link. */
export async function ensureReviewSkill(
  client: SqlClient,
  surface: string,
  skill: ExtractedSkill,
): Promise<number> {
  const inserted = await client.query(
    `INSERT INTO skills (canonical_name, skill_type, needs_review)
     VALUES ($1, $2, true)
     ON CONFLICT (canonical_name) DO UPDATE SET needs_review = skills.needs_review
     RETURNING id`,
    [surface.trim(), skill.skillType],
  );
  const skillId = Number(inserted.rows[0]?.id);
  await client.query(
    `INSERT INTO skill_aliases (skill_id, alias, lang, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (alias, lang) DO NOTHING`,
    [skillId, surface.trim(), ALIAS_LANG, SkillAliasSource.Llm],
  );
  return skillId;
}
