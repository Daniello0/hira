import type { SkillImportance, SkillMatch } from '@hira/contracts';
import type { ExpandedSkill } from '../graph/expand-skills';
import type { LinkedSkill } from '../graph/link-query-skill';
import type { SqlClient } from '../search/sql-client';

/** A skill attached to one vacancy. */
export interface VacancySkillRow {
  skillId: number;
  importance: SkillImportance;
  evidenceSpan: string | null;
}

/** What the explanation lists need, already loaded. */
export interface ExplainInput {
  vacancySkills: readonly VacancySkillRow[];
  linked: readonly LinkedSkill[];
  expanded: readonly ExpandedSkill[];
  names: ReadonlyMap<number, string>;
  profileSkillIds: ReadonlySet<number> | null;
}

/** The three skill lists of one card. */
export interface SkillExplanation {
  matchedSkills: SkillMatch[];
  relatedSkills: SkillMatch[];
  missingSkills: SkillMatch[];
}

/** Skill lists for the cards this response will return. */
export interface ExplainQuery {
  vacancyIds: readonly string[];
  linked: readonly LinkedSkill[];
  userId?: string;
}

/**
 * Splits vacancy skills into matched, related, and missing.
 * Stub returns empty lists.
 */
export function explainSkills(_input: ExplainInput): SkillExplanation {
  return { matchedSkills: [], relatedSkills: [], missingSkills: [] };
}

/** Loads the three lists for each vacancy. Stub returns an empty map. */
export async function explainVacancies(
  _client: SqlClient,
  _query: ExplainQuery,
): Promise<Map<string, SkillExplanation>> {
  return new Map();
}
