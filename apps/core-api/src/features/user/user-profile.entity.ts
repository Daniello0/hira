import { EmploymentType, SeniorityLevel, WorkFormat } from '@hira/contracts';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';
import { VectorColumn } from '../database/vector.column';

/** Structured seeker profile. `userId` is also the primary key. */
@Entity('user_profiles')
export class UserProfile {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryColumn('uuid')
  userId!: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  headline!: string | null;

  @Column({ type: 'text', nullable: true })
  about!: string | null;

  @Column({ type: 'enum', enum: SeniorityLevel, enumName: 'seniority_level', nullable: true })
  seniority!: SeniorityLevel | null;

  @Column({ type: 'text', array: true, default: '{}' })
  desiredRoles!: string[];

  @Column({ type: 'enum', enum: WorkFormat, enumName: 'work_format', array: true, default: '{}' })
  preferredWorkFormat!: WorkFormat[];

  @Column({
    type: 'enum',
    enum: EmploymentType,
    enumName: 'employment_type',
    array: true,
    default: '{}',
  })
  preferredEmployment!: EmploymentType[];

  @Column({ type: 'int', array: true, default: '{}' })
  preferredLocations!: number[];

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  salaryExpectationMin!: string | null;

  @Column({ type: 'char', length: 3, nullable: true })
  currency!: string | null;

  @Column({ type: 'text', nullable: true })
  education!: string | null;

  @VectorColumn()
  profileEmbedding!: string | null;
}
