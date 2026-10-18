import { TRIGRAM_MATCH_THRESHOLD } from '../memory/memory.constants';

export interface SkillHit {
  skillId: number;
  exactName: boolean;
  exactAlias: boolean;
  trigram: number;
}

/** Prefers an exact name or alias, otherwise the best trigram at or above the retrieval cutoff. */
export function chooseSkill(hits: readonly SkillHit[]): number | null {
  const exact = hits.find((hit) => hit.exactName || hit.exactAlias);
  if (exact !== undefined) return exact.skillId;
  const fuzzy = hits.filter((hit) => hit.trigram >= TRIGRAM_MATCH_THRESHOLD);
  fuzzy.sort(byTrigram);
  return fuzzy[0]?.skillId ?? null;
}

function byTrigram(left: SkillHit, right: SkillHit): number {
  return right.trigram - left.trigram || left.skillId - right.skillId;
}
