import { IngestionStatus, VacancySource } from '@hira/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** One connector run and its counters. */
@Entity('ingestion_runs')
export class IngestionRun {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: VacancySource, enumName: 'vacancy_source' })
  source!: VacancySource;

  @Column({ type: 'varchar', length: 64 })
  jobType!: string;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'enum', enum: IngestionStatus, enumName: 'ingestion_status' })
  status!: IngestionStatus;

  @Column({ type: 'int', default: 0 })
  fetched!: number;

  @Column({ type: 'int', name: 'created', default: 0 })
  createdCount!: number;

  @Column({ type: 'int', name: 'updated', default: 0 })
  updatedCount!: number;

  @Column({ type: 'int', default: 0 })
  skipped!: number;

  @Column({ type: 'int', default: 0 })
  failed!: number;

  @Column({ type: 'jsonb', nullable: true })
  errors!: Record<string, unknown> | null;
}
