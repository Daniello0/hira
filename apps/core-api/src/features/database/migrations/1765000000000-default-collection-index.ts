import { type MigrationInterface, type QueryRunner } from 'typeorm';

export const DEFAULT_COLLECTION_INDEX_UP =
  'CREATE UNIQUE INDEX uq_collections_default_per_user ON collections (user_id) WHERE is_default';

export const DEFAULT_COLLECTION_INDEX_DOWN = 'DROP INDEX uq_collections_default_per_user';

/** One default Saved collection per account. Concurrent first saves rely on this index. */
export class DefaultCollectionIndex1765000000000 implements MigrationInterface {
  public readonly name = 'DefaultCollectionIndex1765000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DEFAULT_COLLECTION_INDEX_UP);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DEFAULT_COLLECTION_INDEX_DOWN);
  }
}
