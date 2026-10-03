import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';
import { VectorColumn } from '../database/vector.column';

/** Canonical occupation. The embedding stays null until the overnight job. */
@Entity('occupations')
export class Occupation {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 256 })
  canonicalName!: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  escoUri!: string | null;

  @VectorColumn()
  embedding!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
