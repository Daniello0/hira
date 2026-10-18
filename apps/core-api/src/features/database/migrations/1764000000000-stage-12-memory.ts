import { ProfileSuggestionKind, ProfileSuggestionStatus } from '@hira/contracts';
import type { MigrationInterface, QueryRunner } from 'typeorm';

const SUGGESTION_KIND = enumType('profile_suggestion_kind', ProfileSuggestionKind);
const SUGGESTION_STATUS = enumType('profile_suggestion_status', ProfileSuggestionStatus);

export const STAGE_12_UP = [
  'ALTER TABLE messages ADD COLUMN IF NOT EXISTS use_memory boolean NOT NULL DEFAULT true',
  'ALTER TABLE call_turns ADD COLUMN IF NOT EXISTS use_memory boolean NOT NULL DEFAULT true',
  'ALTER TABLE user_memories ADD COLUMN IF NOT EXISTS source_call_turn_id uuid',
  SUGGESTION_KIND,
  SUGGESTION_STATUS,
  `CREATE TABLE IF NOT EXISTS profile_suggestions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind profile_suggestion_kind NOT NULL,
    status profile_suggestion_status NOT NULL DEFAULT 'PENDING',
    payload jsonb NOT NULL,
    source profile_skill_source NOT NULL,
    source_message_id uuid REFERENCES messages (id) ON DELETE SET NULL,
    source_document_id uuid REFERENCES user_documents (id) ON DELETE SET NULL,
    source_call_turn_id uuid REFERENCES call_turns (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `DO $$ BEGIN
    ALTER TABLE user_memories ADD CONSTRAINT user_memories_call_turn_fk
      FOREIGN KEY (source_call_turn_id) REFERENCES call_turns (id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    ALTER TABLE user_memories ADD CONSTRAINT user_memories_one_source
      CHECK (source_message_id IS NULL OR source_call_turn_id IS NULL);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_profile_suggestions_pending
    ON profile_suggestions (user_id, kind, payload) WHERE status = 'PENDING'`,
  `DO $$ BEGIN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON profile_suggestions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
];

export const STAGE_12_DOWN = [
  'DROP TRIGGER IF EXISTS set_updated_at ON profile_suggestions',
  'DROP TABLE IF EXISTS profile_suggestions',
  'ALTER TABLE user_memories DROP CONSTRAINT IF EXISTS user_memories_one_source',
  'ALTER TABLE user_memories DROP CONSTRAINT IF EXISTS user_memories_call_turn_fk',
  'ALTER TABLE user_memories DROP COLUMN IF EXISTS source_call_turn_id',
  'ALTER TABLE call_turns DROP COLUMN IF EXISTS use_memory',
  'ALTER TABLE messages DROP COLUMN IF EXISTS use_memory',
  'DROP TYPE IF EXISTS profile_suggestion_status',
  'DROP TYPE IF EXISTS profile_suggestion_kind',
];

/** Columns and the suggestion table the memory stage needs on databases created before it. */
export class Stage12Memory1764000000000 implements MigrationInterface {
  public readonly name = 'Stage12Memory1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of STAGE_12_UP) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const statement of STAGE_12_DOWN) await queryRunner.query(statement);
  }
}

function enumType(name: string, values: Record<string, string>): string {
  const labels = Object.values(values).map((value) => `'${value}'`).join(', ');
  return `DO $$ BEGIN
    CREATE TYPE ${name} AS ENUM (${labels});
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
}
