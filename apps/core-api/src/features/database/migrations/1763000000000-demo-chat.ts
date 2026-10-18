import type { MigrationInterface, QueryRunner } from 'typeorm';

export const DEMO_CHAT_UP = [
  'ALTER TABLE chats ALTER COLUMN user_id DROP NOT NULL',
  'ALTER TABLE chats ADD COLUMN IF NOT EXISTS demo_session_id uuid',
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_chats_demo_session ON chats (demo_session_id)',
  'ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_owner_exactly_one',
  `ALTER TABLE chats ADD CONSTRAINT chats_owner_exactly_one CHECK (
    (user_id IS NOT NULL AND demo_session_id IS NULL)
    OR (user_id IS NULL AND demo_session_id IS NOT NULL)
  )`,
];

export const DEMO_CHAT_DOWN = [
  'ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_owner_exactly_one',
  'DROP INDEX IF EXISTS uq_chats_demo_session',
  'ALTER TABLE chats DROP COLUMN IF EXISTS demo_session_id',
  'DELETE FROM chats WHERE user_id IS NULL',
  'ALTER TABLE chats ALTER COLUMN user_id SET NOT NULL',
];

/** A demo chat is owned by the cookie, not by a shadow account. */
export class DemoChat1763000000000 implements MigrationInterface {
  public readonly name = 'DemoChat1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of DEMO_CHAT_UP) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const statement of DEMO_CHAT_DOWN) await queryRunner.query(statement);
  }
}
