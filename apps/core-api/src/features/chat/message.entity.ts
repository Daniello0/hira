import { MessageRole } from '@hira/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** One turn in a chat. Intent and diagnostics are kept for the evaluation chapter. */
@Entity('messages')
export class Message {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  chatId!: string;

  @Column({ type: 'enum', enum: MessageRole, enumName: 'message_role' })
  role!: MessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', nullable: true })
  intent!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  diagnostics!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  tokenUsage!: Record<string, unknown> | null;
}
