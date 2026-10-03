import { SkillAliasSource } from '@hira/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Alternate spelling of a skill in one language. */
@Entity('skill_aliases')
export class SkillAlias {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  skillId!: number;

  @Column({ type: 'varchar', length: 256 })
  alias!: string;

  @Column({ type: 'char', length: 2 })
  lang!: string;

  @Column({ type: 'enum', enum: SkillAliasSource, enumName: 'skill_alias_source' })
  source!: SkillAliasSource;
}
