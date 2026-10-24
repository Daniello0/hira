import type { SkillSearchHitDto } from '@hira/contracts';

export const SKILL_CATALOG = Symbol('SKILL_CATALOG');

export interface CatalogSkill {
  skillId: number;
  canonicalName: string;
  aliases: string[];
}

/** Read-only skill names for the profile combobox. */
export interface SkillCatalog {
  search(query: string): Promise<SkillSearchHitDto[]>;
}
