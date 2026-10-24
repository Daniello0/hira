import type { SqlClient } from './sql-client';

/** Runs `work` inside BEGIN/COMMIT so `SET LOCAL` stays scoped to it. Rolls back and rethrows on failure. */
export async function inTransaction<T>(client: SqlClient, work: () => Promise<T>): Promise<T> {
  await client.query('BEGIN');
  try {
    const result = await work();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
