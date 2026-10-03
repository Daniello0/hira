import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Region or city. A city row points at its region through `parentId`. */
@Entity('locations')
export class Location {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128 })
  region!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  city!: string | null;

  @Column({ type: 'int', nullable: true })
  parentId!: number | null;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  lat!: string | null;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  lon!: string | null;
}
