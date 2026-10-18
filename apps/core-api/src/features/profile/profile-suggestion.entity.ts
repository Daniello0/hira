import { ProfileSkillSource, ProfileSuggestionKind, ProfileSuggestionStatus } from '@hira/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Timestamps, TimestampsColumn } from '../database/timestamped.entity';

/** A profile change waiting for the user. Accept is the only way it becomes profile data. */
@Entity('profile_suggestions')
export class ProfileSuggestion {
  @TimestampsColumn()
  timestamps!: Timestamps;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: ProfileSuggestionKind, enumName: 'profile_suggestion_kind' })
  kind!: ProfileSuggestionKind;

  @Column({
    type: 'enum',
    enum: ProfileSuggestionStatus,
    enumName: 'profile_suggestion_status',
    default: ProfileSuggestionStatus.Pending,
  })
  status!: ProfileSuggestionStatus;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'enum', enum: ProfileSkillSource, enumName: 'profile_skill_source' })
  source!: ProfileSkillSource;

  @Column({ type: 'uuid', nullable: true })
  sourceMessageId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  sourceDocumentId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  sourceCallTurnId!: string | null;
}
