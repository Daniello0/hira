import { MemoryKind } from '@hira/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';
import { VectorColumn } from '../database/vector.column';

/** Long-term fact about the seeker, with provenance and a revoke timestamp. */
@Entity('user_memories')
export class UserMemory {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: MemoryKind, enumName: 'memory_kind' })
  kind!: MemoryKind;

  @Column({ type: 'text' })
  content!: string;

  @VectorColumn()
  embedding!: string | null;

  @Column({ type: 'real' })
  confidence!: number;

  @Column({ type: 'uuid', nullable: true })
  sourceMessageId!: string | null;

  @Column({ type: 'boolean', default: false })
  isPinned!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
