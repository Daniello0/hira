import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Employer. `normalizedName` is the deduplication key, not a unique constraint. */
@Entity('companies')
export class Company {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 256 })
  name!: string;

  @Column({ type: 'varchar', length: 256 })
  normalizedName!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unp!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  website!: string | null;

  @Column({ type: 'int', nullable: true })
  industryId!: number | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  logoUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
