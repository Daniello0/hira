import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { SkillSearchHitDto } from '@hira/contracts';
import { DataSource } from 'typeorm';
import { TRIGRAM_MATCH_THRESHOLD } from '../memory/memory.constants';
import { SKILL_SEARCH_SQL } from './skill.constants';
import type { SkillCatalog } from './skill.store';

/** PostgreSQL skill catalog. Short queries are rejected before this runs. */
@Injectable()
export class TypeOrmSkillCatalog implements SkillCatalog {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** @inheritdoc */
  async search(query: string): Promise<SkillSearchHitDto[]> {
    const rows = await this.dataSource.query(SKILL_SEARCH_SQL, [query, TRIGRAM_MATCH_THRESHOLD]);
    if (!Array.isArray(rows)) return [];
    return rows.filter(isHit).map((row) => ({ skillId: Number(row.skillId), canonicalName: String(row.canonicalName) }));
  }
}

function isHit(value: unknown): value is { skillId: unknown; canonicalName: unknown } {
  return typeof value === 'object' && value !== null;
}
