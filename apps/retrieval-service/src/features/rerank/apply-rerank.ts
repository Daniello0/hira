import type { FusedHit } from '../fusion/rrf-fusion';

/** Window order plus the untouched tail, cut to `limit`. */
export interface RankedPage {
  hits: FusedHit[];
  rerankApplied: boolean;
}

/**
 * Reorders the first 20 fused hits by rerank score.
 * Stub keeps RRF order and reports that rerank did not apply.
 */
export function applyRerank(
  fused: readonly FusedHit[],
  _scores: readonly number[] | null,
  limit: number,
): RankedPage {
  return { hits: fused.slice(0, limit), rerankApplied: false };
}
