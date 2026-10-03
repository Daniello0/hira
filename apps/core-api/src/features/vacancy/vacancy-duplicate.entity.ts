import { DuplicateDetection } from '@hira/contracts';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Pair of vacancies judged to be the same posting. */
@Entity('vacancy_duplicates')
export class VacancyDuplicate {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryColumn('uuid')
  canonicalVacancyId!: string;

  @PrimaryColumn('uuid')
  duplicateVacancyId!: string;

  @Column({ type: 'real' })
  similarity!: number;

  @Column({ type: 'enum', enum: DuplicateDetection, enumName: 'duplicate_detection' })
  detectedBy!: DuplicateDetection;
}
