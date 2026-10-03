import { Column, type ColumnOptions } from 'typeorm';
import { EMBEDDING_DIMENSION } from './database.constants';

const vectorColumnType = 'vector' as ColumnOptions['type'];

/** Nullable `vector(1024)` column. HNSW indexes are created in SQL, not by synchronize. */
export function VectorColumn(): PropertyDecorator {
  return Column({
    type: vectorColumnType,
    length: EMBEDDING_DIMENSION,
    nullable: true,
  });
}
