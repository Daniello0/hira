import type { FusedHit } from '../fusion/rrf-fusion';
import { RERANK_WINDOW } from '../search/search.constants';

/** Window order plus the untouched tail, cut to `limit`. */
export interface RankedPage {
  hits: FusedHit[];
  rerankApplied: boolean;
}

/** Reorders the first 20 fused hits by rerank score. A null score list keeps RRF order. */
export function applyRerank(
  fused: readonly FusedHit[],
  scores: readonly number[] | null,
  limit: number,
): RankedPage {
  if (scores === null) return { hits: fused.slice(0, limit), rerankApplied: false };
  const ranked = rerankWindow(fused.slice(0, RERANK_WINDOW), scores);
  return { hits: [...ranked, ...fused.slice(RERANK_WINDOW)].slice(0, limit), rerankApplied: true };
}

function rerankWindow(window: readonly FusedHit[], scores: readonly number[]): FusedHit[] {
  return window
    .map((hit, index) => ({ hit, score: scores[index] ?? Number.NEGATIVE_INFINITY, index }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.hit);
}
