import { AuthorKind } from '@hira/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Saved vacancy. `collectionId`, when set, is a collection of this same user. */
@Entity('favorites')
export class Favorite {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  vacancyId!: string;

  @Column({ type: 'uuid', nullable: true })
  collectionId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'enum', enum: AuthorKind, enumName: 'author_kind' })
  addedBy!: AuthorKind;
}
