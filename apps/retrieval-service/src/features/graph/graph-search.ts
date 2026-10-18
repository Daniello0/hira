import type { HardConstraints } from '@hira/contracts';
import type { BranchHit } from '../search/branch-hit';
import type { SqlClient } from '../search/sql-client';

/**
 * Graph branch: coverage over a two-hop CTE.
 * Stub returns no hits.
 */
export async function searchGraph(
  _client: SqlClient,
  _skillIds: readonly number[],
  _filters: HardConstraints,
): Promise<BranchHit[]> {
  return [];
}

/** Coverage of specific vacancies, including ones outside the graph top-100. */
export async function coverageFor(
  _client: SqlClient,
  _skillIds: readonly number[],
  _vacancyIds: readonly string[],
): Promise<Map<string, number>> {
  return new Map();
}
