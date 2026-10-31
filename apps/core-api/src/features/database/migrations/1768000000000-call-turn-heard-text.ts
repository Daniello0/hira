import type { MigrationInterface, QueryRunner } from 'typeorm';

/** How far a reply got before the user cut it off. */
export class CallTurnHeardText1768000000000 implements MigrationInterface {
  public readonly name = 'CallTurnHeardText1768000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE call_turns ADD COLUMN IF NOT EXISTS heard_text text');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE call_turns DROP COLUMN IF EXISTS heard_text');
  }
}
