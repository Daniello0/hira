import { TRIGRAM_MATCH_THRESHOLD, VECTOR_MATCH_THRESHOLD } from '../search/search.constants';

/** One skill the query resolved. A repeated id is still one seed. */
export interface LinkedSkill {
  surface: string;
  skillId: number;
  step: 'id' | 'exact' | 'alias' | 'trigram' | 'vector';
}

/** Scores already computed for one surface. The cascade does not talk to the database. */
export interface LinkHit {
  skillId: number;
  exactName: boolean;
  exactAlias: boolean;
  trigram: number;
  cosine: number;
}

const DECIMAL_ID = /^[1-9]\d*$/;

/**
 * Links a surface to an existing skill.
 * A miss returns null: the query must not create a node.
 */
export function linkQuerySkill(surface: string, hits: readonly LinkHit[]): LinkedSkill | null {
  if (surface.trim().length === 0) return null;
  const exact = exactHit(hits);
  if (exact !== undefined) return linked(surface, exact.skillId, exact.step);
  const scored = scoredHit(hits);
  return scored === undefined ? null : linked(surface, scored.skillId, scored.step);
}

/**
 * Uses a decimal canonical id when that skill exists.
 * Otherwise the caller falls through to the cascade.
 */
export function linkMention(
  mention: { surface: string; canonicalId: string | null },
  knownIds: ReadonlySet<number>,
  hits: readonly LinkHit[],
): LinkedSkill | null {
  if (mention.surface.trim().length === 0) return null;
  const id = canonicalSkillId(mention.canonicalId, knownIds);
  if (id !== null) return linked(mention.surface, id, 'id');
  return linkQuerySkill(mention.surface, hits);
}

/** One id per resolved skill, first mention wins. */
export function seedIds(linked: readonly LinkedSkill[]): number[] {
  const ids: number[] = [];
  for (const item of linked) keepId(ids, item.skillId);
  return ids;
}

function exactHit(
  hits: readonly LinkHit[],
): { skillId: number; step: 'exact' | 'alias' } | undefined {
  const named = hits.find((hit) => hit.exactName);
  if (named !== undefined) return { skillId: named.skillId, step: 'exact' };
  const alias = hits.find((hit) => hit.exactAlias);
  if (alias !== undefined) return { skillId: alias.skillId, step: 'alias' };
  return undefined;
}

function scoredHit(
  hits: readonly LinkHit[],
): { skillId: number; step: 'trigram' | 'vector' } | undefined {
  const trigram = bestScore(hits, (hit) => hit.trigram, TRIGRAM_MATCH_THRESHOLD);
  if (trigram !== undefined) return { skillId: trigram.skillId, step: 'trigram' };
  const vector = bestScore(hits, (hit) => hit.cosine, VECTOR_MATCH_THRESHOLD);
  if (vector !== undefined) return { skillId: vector.skillId, step: 'vector' };
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

function canonicalSkillId(value: string | null, knownIds: ReadonlySet<number>): number | null {
  if (value === null || !DECIMAL_ID.test(value)) return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || !knownIds.has(id)) return null;
  return id;
}

function linked(surface: string, skillId: number, step: LinkedSkill['step']): LinkedSkill {
  return { surface, skillId, step };
}

function keepId(ids: number[], skillId: number): void {
  if (!ids.includes(skillId)) ids.push(skillId);
}
