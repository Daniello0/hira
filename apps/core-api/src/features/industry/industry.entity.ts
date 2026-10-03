import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Industry reference row. Companies point here and keep a null when it is removed. */
@Entity('industries')
export class Industry {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 256 })
  name!: string;
}
