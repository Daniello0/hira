import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** How typical a skill is for an occupation. */
@Entity('occupation_skills')
export class OccupationSkill {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryColumn('int')
  occupationId!: number;

  @PrimaryColumn('int')
  skillId!: number;

  @Column({ type: 'real' })
  typicality!: number;
}
