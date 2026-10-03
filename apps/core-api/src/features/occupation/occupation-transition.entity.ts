import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Career move from one occupation to another, with the missing skills. */
@Entity('occupation_transitions')
export class OccupationTransition {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryColumn('int')
  fromOccupationId!: number;

  @PrimaryColumn('int')
  toOccupationId!: number;

  @Column({ type: 'int', default: 0 })
  frequency!: number;

  @Column({ type: 'int', array: true, default: '{}' })
  skillGap!: number[];
}
