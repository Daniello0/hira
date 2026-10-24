import {
  SkillEdgeType,
  SkillImportance,
  type SkillGapDto,
  type SkillGapItem,
  type VacancySkillDto,
} from '@hira/contracts';
import {
  loadEdges,
  loadNames,
  loadProfile,
  loadVacancySkills,
  type VacancySkillRow,
} from '../explain/explain-skills';
import { expandSkills, type GraphEdge } from '../graph/expand-skills';
import type { SqlClient } from '../search/sql-client';

/** Everything the gap needs, already loaded. */
export interface SkillGapInput {
  vacancyId: string;
  vacancySkills: readonly VacancySkillRow[];
  owned: ReadonlySet<number>;
  edges: readonly GraphEdge[];
  names: ReadonlyMap<number, string>;
}

/** What the owned skills reach within two hops. */
interface Reach {
  /** Reached only through ALTERNATIVE_OF: a synonym of an owned skill counts as owned. */
  synonyms: Set<number>;
  /** Reached skill id → owned skill ids that lead to it. */
  leadsFrom: Map<number, Set<number>>;
}

const IMPORTANCE_ORDER = [
  SkillImportance.Required,
  SkillImportance.Preferred,
  SkillImportance.Mentioned,
];

/**
 * US-6 skill gap. Matched = owned directly (aliases share the skill id) or through an
 * ALTERNATIVE_OF path. Missing = required or preferred and not matched, each with the owned
 * skills one or two hops away. Coverage = matched / (required + preferred), 1 when there are none.
 */
export function buildSkillGap(input: SkillGapInput): SkillGapDto {
  const reach = reachOf(input.owned, input.edges);
  const rows = sortedRows(input.vacancySkills);
  const isMatched = (row: VacancySkillRow) =>
    input.owned.has(row.skillId) || reach.synonyms.has(row.skillId);
  const matched = rows.filter(isMatched);
  const missing = rows.filter((row) => counted(row) && !isMatched(row));
  return {
    vacancyId: input.vacancyId,
    matched: matched.map((row) => skillDto(row, input.names)),
    missing: missing.map((row) => gapItem(row, reach, input.names)),
    coverage: coverageOf(rows, matched),
  };
}

/** Loads the vacancy skills, the profile, and the graph around it. Null for an unknown vacancy. */
export async function loadSkillGap(
  client: SqlClient,
  vacancyId: string,
  userId: string,
): Promise<SkillGapDto | null> {
  const exists = await client.query('SELECT 1 FROM vacancies WHERE id = $1', [vacancyId]);
  if (exists.rows.length === 0) return null;
  const vacancySkills = (await loadVacancySkills(client, [vacancyId])).get(vacancyId) ?? [];
  const owned = (await loadProfile(client, userId)) ?? new Set<number>();
  const edges = await loadEdges(client, [...owned]);
  const ids = [...owned, ...vacancySkills.map((row) => row.skillId)];
  const names = await loadNames(client, ids);
  return buildSkillGap({ vacancyId, vacancySkills, owned, edges, names });
}

function reachOf(owned: ReadonlySet<number>, edges: readonly GraphEdge[]): Reach {
  const reach: Reach = { synonyms: new Set(), leadsFrom: new Map() };
  for (const ownedId of owned) {
    for (const node of expandSkills([ownedId], edges)) {
      if (node.hop === 0) continue;
      if (node.trail.every((step) => step.edgeType === SkillEdgeType.AlternativeOf))
        reach.synonyms.add(node.skillId);
      const sources = reach.leadsFrom.get(node.skillId) ?? new Set<number>();
      reach.leadsFrom.set(node.skillId, sources.add(ownedId));
    }
  }
  return reach;
}

function gapItem(
  row: VacancySkillRow,
  reach: Reach,
  names: ReadonlyMap<number, string>,
): SkillGapItem {
  const sources = [...(reach.leadsFrom.get(row.skillId) ?? [])];
  return {
    skillId: row.skillId,
    name: nameOf(names, row.skillId),
    importance: row.importance,
    relatedOwned: sources
      .map((skillId) => nameOf(names, skillId))
      .sort((a, b) => a.localeCompare(b)),
  };
}

function skillDto(row: VacancySkillRow, names: ReadonlyMap<number, string>): VacancySkillDto {
  return {
    skillId: row.skillId,
    name: nameOf(names, row.skillId),
    importance: row.importance,
    evidenceSpan: row.evidenceSpan,
  };
}

function coverageOf(rows: readonly VacancySkillRow[], matched: readonly VacancySkillRow[]): number {
  const total = rows.filter(counted).length;
  if (total === 0) return 1;
  return matched.filter(counted).length / total;
}

function counted(row: VacancySkillRow): boolean {
  return (
    row.importance === SkillImportance.Required || row.importance === SkillImportance.Preferred
  );
}

function sortedRows(rows: readonly VacancySkillRow[]): VacancySkillRow[] {
  return [...rows].sort(
    (left, right) =>
      IMPORTANCE_ORDER.indexOf(left.importance) - IMPORTANCE_ORDER.indexOf(right.importance) ||
      left.skillId - right.skillId,
  );
}

function nameOf(names: ReadonlyMap<number, string>, skillId: number): string {
  return names.get(skillId) ?? String(skillId);
}
