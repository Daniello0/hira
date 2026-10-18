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

/**
 * Links a surface to an existing skill.
 * A miss returns null: the query must not create a node.
 */
export function linkQuerySkill(_surface: string, _hits: readonly LinkHit[]): LinkedSkill | null {
  return null;
}

/**
 * Uses a decimal canonical id when that skill exists.
 * Otherwise the caller falls through to the cascade.
 */
export function linkMention(
  _mention: { surface: string; canonicalId: string | null },
  _knownIds: ReadonlySet<number>,
  _hits: readonly LinkHit[],
): LinkedSkill | null {
  return null;
}

/** One id per resolved skill, first mention wins. */
export function seedIds(_linked: readonly LinkedSkill[]): number[] {
  return [];
}
