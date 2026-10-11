import { type MigrationInterface, type QueryRunner } from 'typeorm';

export const REFRESH_TOKEN_HASH_INDEX_UP =
  'CREATE UNIQUE INDEX idx_refresh_tokens_token_hash ON refresh_tokens (token_hash)';

export const REFRESH_TOKEN_HASH_INDEX_DOWN = 'DROP INDEX idx_refresh_tokens_token_hash';

/** Lookup and lock of a refresh token go through `token_hash`, which the initial schema did not index. */
export class RefreshTokenHashIndex1762000000000 implements MigrationInterface {
  public readonly name = 'RefreshTokenHashIndex1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(REFRESH_TOKEN_HASH_INDEX_UP);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(REFRESH_TOKEN_HASH_INDEX_DOWN);
  }
}
