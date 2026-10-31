import { OTHER_CITIES_REGION } from '@hira/contracts';
import type { MigrationInterface, QueryRunner } from 'typeorm';

export const USER_PLAN_UP = [
  `DO $$ BEGIN
     CREATE TYPE user_plan AS ENUM ('FREE', 'PRO', 'MAX');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan user_plan NOT NULL DEFAULT 'FREE'`,
  `INSERT INTO locations (region, city)
   SELECT '${OTHER_CITIES_REGION}', NULL
   WHERE NOT EXISTS (SELECT 1 FROM locations WHERE region = '${OTHER_CITIES_REGION}' AND city IS NULL)`,
];

export const USER_PLAN_DOWN = [
  `UPDATE vacancies SET location_id = NULL
   WHERE location_id IN (SELECT id FROM locations WHERE region = '${OTHER_CITIES_REGION}')`,
  `DELETE FROM locations WHERE region = '${OTHER_CITIES_REGION}' AND city IS NOT NULL`,
  `DELETE FROM locations WHERE region = '${OTHER_CITIES_REGION}'`,
  'ALTER TABLE users DROP COLUMN IF EXISTS plan',
  'DROP TYPE IF EXISTS user_plan',
];

/** The plan of an account, and a home for cities outside the seeded Belarusian list. */
export class UserPlanAndOtherCities1767000000000 implements MigrationInterface {
  public readonly name = 'UserPlanAndOtherCities1767000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of USER_PLAN_UP) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const statement of USER_PLAN_DOWN) await queryRunner.query(statement);
  }
}
