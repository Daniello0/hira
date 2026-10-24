import { Injectable } from '@nestjs/common';
import type { SkillSearchHitDto } from '@hira/contracts';
import { SKILL_SEARCH_LIMIT } from './skill.constants';
import type { CatalogSkill, SkillCatalog } from './skill.store';

/** Process-local catalog. An empty list is the ESCO-not-loaded case. */
@Injectable()
export class MemorySkillCatalog implements SkillCatalog {
  readonly skills: CatalogSkill[] = [];

  /** @inheritdoc */
  search(query: string): Promise<SkillSearchHitDto[]> {
    const needle = query.trim().toLowerCase();
    const hits = this.skills.filter((skill) => matches(skill, needle)).slice(0, SKILL_SEARCH_LIMIT);
    return Promise.resolve(hits.map((skill) => ({ skillId: skill.skillId, canonicalName: skill.canonicalName })));
  }
}

function matches(skill: CatalogSkill, needle: string): boolean {
  if (skill.canonicalName.toLowerCase().includes(needle)) return true;
  return skill.aliases.some((alias) => alias.toLowerCase().includes(needle));
}
