import { SkillType } from '@hira/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';
import { VectorColumn } from '../database/vector.column';

/** Canonical skill node. The embedding stays null until the overnight job. */
@Entity('skills')
export class Skill {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 256 })
  canonicalName!: string;

  @Column({ type: 'enum', enum: SkillType, enumName: 'skill_type' })
  skillType!: SkillType;

  @Column({ type: 'varchar', length: 256, nullable: true })
  escoUri!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @VectorColumn()
  embedding!: string | null;

  @Column({ type: 'real', default: 0 })
  idf!: number;

  @Column({ type: 'int', default: 0 })
  vacancyCount!: number;

  @Column({ type: 'boolean', default: false })
  needsReview!: boolean;
}
