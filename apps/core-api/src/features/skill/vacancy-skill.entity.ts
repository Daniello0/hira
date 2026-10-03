import { SkillImportance } from '@hira/contracts';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Skill required by a vacancy, with a quote from the description. */
@Entity('vacancy_skills')
export class VacancySkill {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryColumn('uuid')
  vacancyId!: string;

  @PrimaryColumn('int')
  skillId!: number;

  @Column({ type: 'enum', enum: SkillImportance, enumName: 'skill_importance' })
  importance!: SkillImportance;

  @Column({ type: 'real' })
  weight!: number;

  @Column({ type: 'text', nullable: true })
  evidenceSpan!: string | null;
}
