import { UserRole } from '@hira/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Registered account. The password column stores an argon2id hash. */
@Entity('users')
export class User {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  displayName!: string | null;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role', default: UserRole.User })
  role!: UserRole;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ type: 'boolean', default: true })
  crossChatMemoryEnabled!: boolean;
}
