import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Snapshot of a vacancy shown for one assistant message. */
@Entity('message_vacancies')
export class MessageVacancy {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryColumn('uuid')
  messageId!: string;

  @PrimaryColumn('uuid')
  vacancyId!: string;

  @Column({ type: 'int' })
  rank!: number;

  @Column({ type: 'real' })
  score!: number;

  @Column({ type: 'jsonb' })
  explanation!: Record<string, unknown>;

  @Column({ type: 'text', array: true })
  retrievedBy!: string[];
}
