import type { SqlClient } from '../store/sql-client';
import { vectorLiteral } from './embed-client';

export type VectorTarget = 'vacancies' | 'skills';

/** Writes one full embedding. A short vector throws before the column is touched. */
export async function writeVector(
  client: SqlClient,
  target: VectorTarget,
  id: string,
  values: readonly number[],
): Promise<void> {
  const literal = vectorLiteral(values);
  const table = target === 'vacancies' ? 'vacancies' : 'skills';
  await client.query(`UPDATE ${table} SET embedding = $2::vector WHERE id = $1`, [id, literal]);
}
