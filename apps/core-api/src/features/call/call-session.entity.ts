import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Voice call. It is not inserted into `chats`. */
@Entity('call_sessions')
export class CallSession {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt!: Date | null;
}
