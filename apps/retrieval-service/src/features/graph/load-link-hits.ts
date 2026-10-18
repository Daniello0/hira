import type { SkillMention } from '@hira/contracts';
import type { LinkHit, LinkedSkill } from './link-query-skill';

/** Database and encoder the cascade needs. Tests pass fakes. */
export interface LinkDeps {
  knownIds(ids: readonly number[]): Promise<ReadonlySet<number>>;
  hits(surface: string, vector: string | null): Promise<LinkHit[]>;
  embed(texts: readonly string[]): Promise<number[][]>;
}

/**
 * Resolves query skills without creating nodes.
 * Vector step runs once, and only for surfaces the trigram step missed.
 */
export async function resolveQuerySkills(
  _mentions: readonly SkillMention[],
  _deps: LinkDeps,
): Promise<LinkedSkill[]> {
  return [];
}
