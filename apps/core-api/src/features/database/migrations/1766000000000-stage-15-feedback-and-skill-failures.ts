import type { MigrationInterface, QueryRunner } from 'typeorm';

export const STAGE_15_UP = [
  'ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS skill_extract_failures int NOT NULL DEFAULT 0',
  `DELETE FROM feedback f USING feedback g
    WHERE f.user_id = g.user_id AND f.message_id = g.message_id AND f.vacancy_id = g.vacancy_id
      AND (f.updated_at, f.id) < (g.updated_at, g.id)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_user_message_vacancy ON feedback (user_id, message_id, vacancy_id)',
];

export const STAGE_15_DOWN = [
  'DROP INDEX IF EXISTS uq_feedback_user_message_vacancy',
  'ALTER TABLE vacancies DROP COLUMN IF EXISTS skill_extract_failures',
];

/**
 * One vote per (user, message, vacancy) so `POST /feedback` can upsert, and a per-vacancy
 * failure counter the skill-extraction job uses to stop retrying. Older duplicate votes keep the newest.
 */
export class Stage15FeedbackAndSkillFailures1766000000000 implements MigrationInterface {
  public readonly name = 'Stage15FeedbackAndSkillFailures1766000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of STAGE_15_UP) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const statement of STAGE_15_DOWN) await queryRunner.query(statement);
  }
}
