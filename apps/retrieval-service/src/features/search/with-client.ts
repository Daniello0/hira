import type { Pool, PoolClient } from 'pg';

/** Runs one branch on a single connection so `SET LOCAL` stays with its query. */
export async function withClient<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await run(client);
  } finally {
    client.release();
  }
}
