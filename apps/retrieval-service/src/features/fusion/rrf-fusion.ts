import type { QueryComplexity, RetrievalBranch } from '@hira/contracts';
import type { BranchHit } from '../search/branch-hit';

/** One vacancy after reciprocal rank fusion. */
export interface FusedHit {
  vacancyId: string;
  rrfScore: number;
  retrievedBy: RetrievalBranch[];
}

/**
 * Sums `weight / (k + rank)` over the branches that ran.
 * Stub returns an empty list.
 */
export function fuseBranches(
  _lists: Partial<Record<RetrievalBranch, readonly BranchHit[]>>,
  _complexity: QueryComplexity,
  _overrides: Partial<Record<RetrievalBranch, number>> | undefined,
  _active: readonly RetrievalBranch[],
): FusedHit[] {
  return [];
}
