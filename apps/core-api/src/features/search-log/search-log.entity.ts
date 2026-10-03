import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Search telemetry kept for the evaluation chapter. */
@Entity('search_logs')
export class SearchLog {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  messageId!: string | null;

  @Column({ type: 'text' })
  rawQuery!: string;

  @Column({ type: 'jsonb', nullable: true })
  intent!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  branchTimings!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  candidateCounts!: Record<string, unknown> | null;

  @Column({ type: 'int', nullable: true })
  totalLatencyMs!: number | null;

  @Column({ type: 'boolean', default: false })
  rerankApplied!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  relaxationSteps!: Record<string, unknown> | null;
}
