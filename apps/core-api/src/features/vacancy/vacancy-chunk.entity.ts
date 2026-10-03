import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';
import { VectorColumn } from '../database/vector.column';

/** One slice of a vacancy description, embedded on its own. */
@Entity('vacancy_chunks')
export class VacancyChunk {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  vacancyId!: string;

  @Column({ type: 'int' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;

  @VectorColumn()
  embedding!: string | null;

  @Column({ type: 'int' })
  tokenCount!: number;
}
