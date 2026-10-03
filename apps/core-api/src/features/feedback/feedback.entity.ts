import { FeedbackRating } from '@hira/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** Explicit relevant / irrelevant vote on a shown vacancy. */
@Entity('feedback')
export class Feedback {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  messageId!: string;

  @Column({ type: 'uuid', nullable: true })
  vacancyId!: string | null;

  @Column({ type: 'enum', enum: FeedbackRating, enumName: 'feedback_rating' })
  rating!: FeedbackRating;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;
}
