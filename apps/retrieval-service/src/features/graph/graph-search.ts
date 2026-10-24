import { SkillEdgeType } from '@hira/contracts';
import type { BranchHit } from '../search/branch-hit';
import { hardFilterSql, type SearchFilters } from '../search/hard-filters';
import {
  BRANCH_LIMIT,
  EDGE_DECAY,
  GRAPH_MAX_HOP,
  GRAPH_NODE_CAP,
  GRAPH_WEIGHT_FLOOR,
  SEED_WEIGHT,
} from '../search/search.constants';
import type { SqlClient } from '../search/sql-client';

interface CoverageRow {
  id: string;
  coverage: number;
}

/** Graph branch: IDF-weighted coverage over a two-hop CTE, top 100. */
export async function searchGraph(
  client: SqlClient,
  skillIds: readonly number[],
  filters: SearchFilters,
): Promise<BranchHit[]> {
  const rows = await coverageRows(client, skillIds, filters, null);
  return rows.map((row, index) => ({ vacancyId: row.id, rank: index + 1, score: row.coverage }));
}

/** Coverage of specific vacancies, including ones outside the graph top-100. */
export async function coverageFor(
  client: SqlClient,
  skillIds: readonly number[],
  vacancyIds: readonly string[],
): Promise<Map<string, number>> {
  const rows = await coverageRows(client, skillIds, {}, vacancyIds);
  return new Map(rows.map((row) => [row.id, row.coverage]));
}

async function coverageRows(
  client: SqlClient,
  skillIds: readonly number[],
  filters: SearchFilters,
  vacancyIds: readonly string[] | null,
): Promise<CoverageRow[]> {
  if (skillIds.length === 0) return [];
  if (vacancyIds !== null && vacancyIds.length === 0) return [];
  const filter = hardFilterSql(filters, vacancyIds === null ? 2 : 3);
  const params =
    vacancyIds === null ? [skillIds, ...filter.params] : [skillIds, vacancyIds, ...filter.params];
  const result = await client.query(coverageSql(filter.sql, vacancyIds !== null), params);
  return result.rows.map(readCoverage);
}

function readCoverage(row: Record<string, unknown>): CoverageRow {
  return { id: String(row.id), coverage: Number(row.coverage) };
}

function coverageSql(filterSql: string, restrictIds: boolean): string {
  const limit = restrictIds ? '' : `LIMIT ${BRANCH_LIMIT}`;
  const ids = restrictIds ? ' AND v.id = ANY($2::uuid[])' : '';
  return `${expandedSql()}
    SELECT id, coverage FROM (
      SELECT vs.vacancy_id::text AS id,
             SUM(x.w * vs.weight * s.idf) / NULLIF(SUM(s.idf), 0) AS coverage
      FROM capped x
      JOIN vacancy_skills vs ON vs.skill_id = x.skill_id
      JOIN skills s ON s.id = x.skill_id
      JOIN vacancies v ON v.id = vs.vacancy_id
      WHERE ${filterSql}${ids}
      GROUP BY vs.vacancy_id
    ) scored
    WHERE coverage IS NOT NULL
    ORDER BY coverage DESC, id
    ${limit}`;
}

function expandedSql(): string {
  return `WITH RECURSIVE expanded AS (
      ${seedSelect()}
      UNION ALL
      ${stepSelect(allowedTypes())}
    ),
    best AS (
      SELECT skill_id, MAX(w) AS w FROM expanded GROUP BY skill_id
    ),
    capped AS (
      SELECT skill_id, w FROM best ORDER BY w DESC, skill_id LIMIT ${GRAPH_NODE_CAP}
    )`;
}

function seedSelect(): string {
  return `SELECT id AS skill_id, ${SEED_WEIGHT}::float8 AS w, 0 AS hop
      FROM skills WHERE id = ANY($1::int[])`;
}

function stepSelect(allowed: string): string {
  return `SELECT e.target_skill_id,
             (x.w * e.weight * ${decayCase()})::float8,
             x.hop + 1
      FROM expanded x
      JOIN skill_edges e ON e.source_skill_id = x.skill_id
      WHERE x.hop < ${GRAPH_MAX_HOP} AND x.w > ${GRAPH_WEIGHT_FLOOR}
        AND e.edge_type IN (${allowed})`;
}

function allowedTypes(): string {
  return [SkillEdgeType.AlternativeOf, SkillEdgeType.Narrower, SkillEdgeType.RelatedTo]
    .map((edge) => `'${edge}'`)
    .join(', ');
}

function decayCase(): string {
  return `CASE e.edge_type
    WHEN '${SkillEdgeType.AlternativeOf}' THEN ${EDGE_DECAY[SkillEdgeType.AlternativeOf]}
    WHEN '${SkillEdgeType.Narrower}' THEN ${EDGE_DECAY[SkillEdgeType.Narrower]}
    WHEN '${SkillEdgeType.RelatedTo}' THEN ${EDGE_DECAY[SkillEdgeType.RelatedTo]}
  END`;
}
