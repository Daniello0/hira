import { ProfileSkillSource, SkillLevel } from '@hira/contracts';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Skill the seeker claims or that was extracted for confirmation. */
@Entity('user_profile_skills')
export class UserProfileSkill {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryColumn('uuid')
  userId!: string;

  @PrimaryColumn('int')
  skillId!: number;

  @Column({ type: 'enum', enum: SkillLevel, enumName: 'skill_level' })
  level!: SkillLevel;

  @Column({ type: 'int', nullable: true })
  years!: number | null;

  @Column({ type: 'enum', enum: ProfileSkillSource, enumName: 'profile_skill_source' })
  source!: ProfileSkillSource;

  @Column({ type: 'real' })
  confidence!: number;
}
