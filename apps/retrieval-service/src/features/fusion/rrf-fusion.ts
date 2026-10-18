import { type QueryComplexity, type RetrievalBranch } from '@hira/contracts';
import type { BranchHit } from '../search/branch-hit';
import { COMPLEXITY_WEIGHTS, RRF_K } from '../search/search.constants';

/** One vacancy after reciprocal rank fusion. */
export interface FusedHit {
  vacancyId: string;
  rrfScore: number;
  retrievedBy: RetrievalBranch[];
}

interface Running {
  score: number;
  retrievedBy: RetrievalBranch[];
}

/** Sums `weight / (k + rank)` over the branches that actually ran. */
export function fuseBranches(
  lists: Partial<Record<RetrievalBranch, readonly BranchHit[]>>,
  complexity: QueryComplexity,
  overrides: Partial<Record<RetrievalBranch, number>> | undefined,
  active: readonly RetrievalBranch[],
): FusedHit[] {
  const totals = new Map<string, Running>();
  for (const branch of active)
    addBranch(totals, branch, lists[branch] ?? [], weightOf(branch, complexity, overrides));
  return [...totals.entries()].map(toHit).sort(byScoreThenId);
}

function addBranch(
  totals: Map<string, Running>,
  branch: RetrievalBranch,
  hits: readonly BranchHit[],
  weight: number,
): void {
  for (const hit of hits) addHit(totals, hit, branch, weight / (RRF_K + hit.rank));
}

function addHit(
  totals: Map<string, Running>,
  hit: BranchHit,
  branch: RetrievalBranch,
  term: number,
): void {
  const current = totals.get(hit.vacancyId) ?? { score: 0, retrievedBy: [] };
  current.score += term;
  current.retrievedBy.push(branch);
  totals.set(hit.vacancyId, current);
}

function weightOf(
  branch: RetrievalBranch,
  complexity: QueryComplexity,
  overrides: Partial<Record<RetrievalBranch, number>> | undefined,
): number {
  const override = overrides?.[branch];
  return override === undefined ? COMPLEXITY_WEIGHTS[complexity][branch] : override;
}

function toHit([vacancyId, row]: [string, Running]): FusedHit {
  return { vacancyId, rrfScore: row.score, retrievedBy: row.retrievedBy };
}

function byScoreThenId(left: FusedHit, right: FusedHit): number {
  return right.rrfScore - left.rrfScore || left.vacancyId.localeCompare(right.vacancyId);
}
