import { SkillEdgeType } from '@hira/contracts';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Directed edge in the skill graph. Traversal uses both directions. */
@Entity('skill_edges')
export class SkillEdge {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryColumn('int')
  sourceSkillId!: number;

  @PrimaryColumn('int')
  targetSkillId!: number;

  @PrimaryColumn({ type: 'enum', enum: SkillEdgeType, enumName: 'skill_edge_type' })
  edgeType!: SkillEdgeType;

  @Column({ type: 'real' })
  weight!: number;

  @Column({ type: 'varchar', length: 64 })
  evidence!: string;
}
