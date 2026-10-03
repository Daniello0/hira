import { type MigrationInterface, type QueryRunner } from 'typeorm';
import { INITIAL_SCHEMA_DOWN, INITIAL_SCHEMA_UP } from '../schema-statements';

/** Creates the Hira schema, indexes, and the Belarus location seed. */
export class InitialSchema1760000000000 implements MigrationInterface {
  public readonly name = 'InitialSchema1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await runStatements(queryRunner, INITIAL_SCHEMA_UP);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await runStatements(queryRunner, INITIAL_SCHEMA_DOWN);
  }
}

async function runStatements(
  queryRunner: QueryRunner,
  statements: readonly string[],
): Promise<void> {
  for (const statement of statements) {
    await queryRunner.query(statement);
  }
}
