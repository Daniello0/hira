import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** One conversation. A call session is not a chat. */
@Entity('chats')
export class Chat {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  title!: string | null;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  summaryUpdatedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  messageCount!: number;

  @Column({ type: 'boolean', default: false })
  isArchived!: boolean;
}
