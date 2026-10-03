import { AuthorKind } from '@hira/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Transcript line of a call. Search cards, when present, are stored on `results`. */
@Entity('call_turns')
export class CallTurn {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'enum', enum: AuthorKind, enumName: 'author_kind' })
  role!: AuthorKind;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', nullable: true })
  results!: Record<string, unknown> | null;
}
