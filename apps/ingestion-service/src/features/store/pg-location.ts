import type { CanonicalVacancy } from '../normalize/normalize-vacancy';
import type { SqlClient } from './sql-client';

/** Reuses a seeded city or inserts a new one under its region. */
export async function resolveLocationId(
  client: SqlClient,
  vacancy: CanonicalVacancy,
): Promise<number | null> {
  if (vacancy.region === null) return null;
  const found = await findLocation(client, vacancy.region, vacancy.city);
  if (found !== null) return found;
  if (vacancy.city === null) return null;
  const parent = await findLocation(client, vacancy.region, null);
  if (parent === null) return null;
  const inserted = await client.query(
    `INSERT INTO locations (region, city, parent_id) VALUES ($1, $2, $3) RETURNING id`,
    [vacancy.region, vacancy.city, parent],
  );
  return Number(inserted.rows[0]?.id);
}

async function findLocation(
  client: SqlClient,
  region: string,
  city: string | null,
): Promise<number | null> {
  const result = await client.query(
    `SELECT id FROM locations WHERE region = $1 AND city IS NOT DISTINCT FROM $2 LIMIT 1`,
    [region, city],
  );
  const id = result.rows[0]?.id;
  return id === undefined ? null : Number(id);
}
