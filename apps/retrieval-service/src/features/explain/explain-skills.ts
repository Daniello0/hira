import { SkillEdgeType, SkillImportance, type SkillMatch } from '@hira/contracts';
import {
  expandSkills,
  type ExpandedSkill,
  type GraphEdge,
  type TrailStep,
} from '../graph/expand-skills';
import { seedIds, type LinkedSkill } from '../graph/link-query-skill';
import { GRAPH_MAX_HOP } from '../search/search.constants';
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

/** Splits vacancy skills into matched, related, and missing. */
export function explainSkills(input: ExplainInput): SkillExplanation {
  const surfaces = surfacesOf(input.linked);
  const expanded = new Map(input.expanded.map((item) => [item.skillId, item]));
  const matched: SkillMatch[] = [];
  const related: SkillMatch[] = [];
  for (const skill of sorted(input.vacancySkills))
    placeSkill(skill, surfaces, expanded, input.names, matched, related);
  return {
    matchedSkills: matched,
    relatedSkills: related,
    missingSkills: missingOf(input, surfaces),
  };
}

/** Loads the three lists for each vacancy. */
export async function explainVacancies(
  client: SqlClient,
  query: ExplainQuery,
): Promise<Map<string, SkillExplanation>> {
  if (query.vacancyIds.length === 0) return new Map();
  const loaded = await loadExplain(client, query);
  const result = new Map<string, SkillExplanation>();
  for (const vacancyId of query.vacancyIds)
    result.set(vacancyId, explainOne(vacancyId, query, loaded));
  return result;
}

interface ExplainLoad {
  skills: Map<string, VacancySkillRow[]>;
  expanded: ExpandedSkill[];
  names: Map<number, string>;
  profile: ReadonlySet<number> | null;
}

async function loadExplain(client: SqlClient, query: ExplainQuery): Promise<ExplainLoad> {
  const seeds = seedIds(query.linked);
  const skills = await loadVacancySkills(client, query.vacancyIds);
  const edges = await loadEdges(client, seeds);
  const names = await loadNames(client, nameIds(seeds, skills, edges));
  return {
    skills,
    expanded: expandSkills(seeds, edges),
    names,
    profile: await loadProfile(client, query.userId),
  };
}

function explainOne(vacancyId: string, query: ExplainQuery, loaded: ExplainLoad): SkillExplanation {
  return explainSkills({
    vacancySkills: loaded.skills.get(vacancyId) ?? [],
    linked: query.linked,
    expanded: loaded.expanded,
    names: loaded.names,
    profileSkillIds: loaded.profile,
  });
}

function placeSkill(
  skill: VacancySkillRow,
  surfaces: ReadonlyMap<number, string>,
  expanded: ReadonlyMap<number, ExpandedSkill>,
  names: ReadonlyMap<number, string>,
  matched: SkillMatch[],
  related: SkillMatch[],
): void {
  const node = expanded.get(skill.skillId);
  const match = toMatch(skill, surfaces, names, node);
  if (surfaces.has(skill.skillId)) matched.push({ ...match, path: null });
  else if (node !== undefined && node.trail.length > 0 && alternativeOnly(node))
    matched.push(match);
  else if (node !== undefined && node.trail.length > 0) related.push(match);
}

function missingOf(input: ExplainInput, surfaces: ReadonlyMap<number, string>): SkillMatch[] {
  if (input.profileSkillIds === null) return [];
  return sorted(input.vacancySkills)
    .filter(
      (skill) =>
        skill.importance === SkillImportance.Required && !input.profileSkillIds?.has(skill.skillId),
    )
    .map((skill) => ({ ...toMatch(skill, surfaces, input.names, undefined), path: null }));
}

function toMatch(
  skill: VacancySkillRow,
  surfaces: ReadonlyMap<number, string>,
  names: ReadonlyMap<number, string>,
  node: ExpandedSkill | undefined,
): SkillMatch {
  return {
    surface: surfaces.get(skill.skillId) ?? label(names, skill.skillId),
    canonicalId: String(skill.skillId),
    evidenceSpan: skill.evidenceSpan,
    path: node === undefined ? null : pathText(node.trail, names),
  };
}

function pathText(trail: readonly TrailStep[], names: ReadonlyMap<number, string>): string | null {
  const first = trail[0];
  if (first === undefined) return null;
  const parts = [label(names, first.fromSkillId)];
  for (const step of trail) parts.push(step.edgeType, label(names, step.toSkillId));
  return parts.join(' → ');
}

function alternativeOnly(node: ExpandedSkill): boolean {
  return node.trail.every((step) => step.edgeType === SkillEdgeType.AlternativeOf);
}

function surfacesOf(linked: readonly LinkedSkill[]): Map<number, string> {
  const surfaces = new Map<number, string>();
  for (const item of linked)
    if (!surfaces.has(item.skillId)) surfaces.set(item.skillId, item.surface);
  return surfaces;
}

function sorted(skills: readonly VacancySkillRow[]): VacancySkillRow[] {
  return [...skills].sort((left, right) => left.skillId - right.skillId);
}

function label(names: ReadonlyMap<number, string>, skillId: number): string {
  return names.get(skillId) ?? String(skillId);
}

/** Skills attached to each vacancy, grouped by vacancy id. */
export async function loadVacancySkills(
  client: SqlClient,
  vacancyIds: readonly string[],
): Promise<Map<string, VacancySkillRow[]>> {
  const result = await client.query(
    `SELECT vs.vacancy_id::text AS "vacancyId", vs.skill_id AS "skillId",
            vs.importance, vs.evidence_span AS "evidenceSpan"
     FROM vacancy_skills vs WHERE vs.vacancy_id = ANY($1::uuid[])`,
    [vacancyIds],
  );
  const grouped = new Map<string, VacancySkillRow[]>();
  for (const row of result.rows) pushSkill(grouped, row);
  return grouped;
}

function pushSkill(grouped: Map<string, VacancySkillRow[]>, row: Record<string, unknown>): void {
  const vacancyId = String(row.vacancyId);
  const list = grouped.get(vacancyId) ?? [];
  list.push({
    skillId: Number(row.skillId),
    importance: row.importance as SkillImportance,
    evidenceSpan:
      row.evidenceSpan === null || row.evidenceSpan === undefined ? null : String(row.evidenceSpan),
  });
  grouped.set(vacancyId, list);
}

/** Edges reachable from the seeds within two hops, of the walked edge types. */
export async function loadEdges(client: SqlClient, seeds: readonly number[]): Promise<GraphEdge[]> {
  if (seeds.length === 0) return [];
  const allowed = [SkillEdgeType.AlternativeOf, SkillEdgeType.Narrower, SkillEdgeType.RelatedTo];
  const result = await client.query(EDGE_SQL, [seeds, allowed]);
  return result.rows.map(readEdge);
}

function readEdge(row: Record<string, unknown>): GraphEdge {
  return {
    sourceSkillId: Number(row.sourceSkillId),
    targetSkillId: Number(row.targetSkillId),
    edgeType: row.edgeType as SkillEdgeType,
    weight: Number(row.weight),
  };
}

/** Canonical skill names by id. */
export async function loadNames(
  client: SqlClient,
  ids: readonly number[],
): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const result = await client.query(
    'SELECT id, canonical_name AS name FROM skills WHERE id = ANY($1::int[])',
    [ids],
  );
  return new Map(result.rows.map((row) => [Number(row.id), String(row.name)]));
}

/** Profile skill ids of a user; null when no user is given. */
export async function loadProfile(
  client: SqlClient,
  userId: string | undefined,
): Promise<ReadonlySet<number> | null> {
  if (userId === undefined) return null;
  const result = await client.query(
    'SELECT skill_id AS "skillId" FROM user_profile_skills WHERE user_id = $1',
    [userId],
  );
  return new Set(result.rows.map((row) => Number(row.skillId)));
}

function nameIds(
  seeds: readonly number[],
  skills: Map<string, VacancySkillRow[]>,
  edges: readonly GraphEdge[],
): number[] {
  const ids = new Set<number>(seeds);
  for (const rows of skills.values()) for (const row of rows) ids.add(row.skillId);
  for (const edge of edges) {
    ids.add(edge.sourceSkillId);
    ids.add(edge.targetSkillId);
  }
  return [...ids];
}

const EDGE_SQL = `WITH RECURSIVE walk AS (
    SELECT unnest($1::int[]) AS skill_id, 0 AS hop
    UNION ALL
    SELECT e.target_skill_id, w.hop + 1
    FROM walk w
    JOIN skill_edges e ON e.source_skill_id = w.skill_id
    WHERE w.hop < ${GRAPH_MAX_HOP} AND e.edge_type = ANY($2::skill_edge_type[])
  )
  SELECT DISTINCT e.source_skill_id AS "sourceSkillId", e.target_skill_id AS "targetSkillId",
         e.edge_type AS "edgeType", e.weight
  FROM skill_edges e
  JOIN walk w ON w.skill_id = e.source_skill_id
  WHERE e.edge_type = ANY($2::skill_edge_type[])`;
