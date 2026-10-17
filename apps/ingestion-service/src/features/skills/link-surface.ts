import { TRIGRAM_MATCH_THRESHOLD, VECTOR_MATCH_THRESHOLD } from '../ingestion.constants';

/** Scores already computed by SQL. The cascade does not talk to the database. */
export interface LinkHit {
  skillId: number;
  exactName: boolean;
  exactAlias: boolean;
  trigram: number;
  cosine: number;
}

export type LinkDecision =
  | { kind: 'match'; skillId: number; step: 'exact' | 'alias' | 'trigram' | 'vector' }
  | { kind: 'create' };

/** Case-insensitive exact flags for a canonical name and its aliases. */
export function matchFlags(
  surface: string,
  candidate: { canonicalName: string; aliases: readonly string[] },
): { exactName: boolean; exactAlias: boolean } {
  const key = normalizeLabel(surface);
  if (key.length === 0) return { exactName: false, exactAlias: false };
  return {
    exactName: normalizeLabel(candidate.canonicalName) === key,
    exactAlias: candidate.aliases.some((alias) => normalizeLabel(alias) === key),
  };
}

/**
 * Links a surface to a skill.
 * Order is exact name, alias, trigram 0.8, cosine 0.85, otherwise a new node.
 */
export function linkSurface(surface: string, hits: readonly LinkHit[]): LinkDecision {
  if (surface.trim().length === 0) return { kind: 'create' };
  return exactDecision(hits) ?? scoredDecision(hits) ?? { kind: 'create' };
}

function exactDecision(hits: readonly LinkHit[]): LinkDecision | undefined {
  const named = hits.find((hit) => hit.exactName);
  if (named !== undefined) return matched(named.skillId, 'exact');
  const alias = hits.find((hit) => hit.exactAlias);
  if (alias !== undefined) return matched(alias.skillId, 'alias');
  return undefined;
}

function scoredDecision(hits: readonly LinkHit[]): LinkDecision | undefined {
  const trigram = bestScore(hits, (hit) => hit.trigram, TRIGRAM_MATCH_THRESHOLD);
  if (trigram !== undefined) return matched(trigram.skillId, 'trigram');
  const vector = bestScore(hits, (hit) => hit.cosine, VECTOR_MATCH_THRESHOLD);
  if (vector !== undefined) return matched(vector.skillId, 'vector');
  return undefined;
}

function bestScore(
  hits: readonly LinkHit[],
  score: (hit: LinkHit) => number,
  threshold: number,
): LinkHit | undefined {
  return hits
    .filter((hit) => Number.isFinite(score(hit)) && score(hit) >= threshold)
    .sort((left, right) => score(right) - score(left) || left.skillId - right.skillId)[0];
}

function matched(skillId: number, step: 'exact' | 'alias' | 'trigram' | 'vector'): LinkDecision {
  return { kind: 'match', skillId, step };
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}
