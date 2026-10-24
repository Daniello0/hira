import type { SkillImportance, VacancyDetailDto, VacancySkillDto } from '@hira/contracts';
import { loadVacancyCards } from '../chat/vacancy-card';
import type { Sql } from '../chat/typeorm-chat.sql';
import { typeormRows } from '../database/typeorm-rows';

const VACANCY_SKILLS_SQL = `SELECT vs.skill_id AS "skillId", s.canonical_name AS name, vs.importance::text AS importance,
  vs.evidence_span AS "evidenceSpan"
  FROM vacancy_skills vs
  JOIN skills s ON s.id = vs.skill_id
  WHERE vs.vacancy_id = $1
  ORDER BY vs.importance, vs.weight DESC, s.canonical_name`;

/** Full card with its skills, or null when the vacancy is not in the corpus. */
export async function loadVacancyDetail(sql: Sql, vacancyId: string): Promise<VacancyDetailDto | null> {
  const card = (await loadVacancyCards(sql, [vacancyId])).get(vacancyId);
  if (card === undefined) return null;
  const rows = typeormRows(await sql.query(VACANCY_SKILLS_SQL, [vacancyId]));
  return { ...card, skills: rows.map(toSkill) };
}

function toSkill(row: Record<string, unknown>): VacancySkillDto {
  return {
    skillId: Number(row.skillId),
    name: String(row.name),
    importance: String(row.importance) as SkillImportance,
    evidenceSpan: typeof row.evidenceSpan === 'string' && row.evidenceSpan.length > 0 ? row.evidenceSpan : null,
  };
}
