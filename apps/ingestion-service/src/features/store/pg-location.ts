import { dictionaryCity } from '../normalize/dictionary-city';
import type { CanonicalVacancy } from '../normalize/normalize-vacancy';
import type { SqlClient } from './sql-client';

type Place = Pick<CanonicalVacancy, 'region' | 'city'>;

/** Reuses a seeded city or inserts a new one under its region. */
export async function resolveLocationId(client: SqlClient, vacancy: Place): Promise<number | null> {
  const city = dictionaryCity(vacancy.city);
  if (vacancy.region === null) return seededCityId(client, city);
  return cityInRegion(client, vacancy.region, city);
}

async function seededCityId(client: SqlClient, city: string | null): Promise<number | null> {
  if (city === null) return null;
  const result = await client.query(
    `SELECT id FROM locations WHERE lower(city) = lower($1) LIMIT 1`,
    [city],
  );
  return numberId(result.rows[0]?.id);
}

async function cityInRegion(
  client: SqlClient,
  region: string,
  city: string | null,
): Promise<number | null> {
  const found = await findLocation(client, region, city);
  if (found !== null || city === null) return found;
  const parent = await findLocation(client, region, null);
  if (parent === null) return null;
  return insertCity(client, region, city, parent);
}

async function insertCity(
  client: SqlClient,
  region: string,
  city: string,
  parent: number,
): Promise<number | null> {
  const inserted = await client.query(
    `INSERT INTO locations (region, city, parent_id) VALUES ($1, $2, $3) RETURNING id`,
    [region, city, parent],
  );
  return numberId(inserted.rows[0]?.id);
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
  return numberId(result.rows[0]?.id);
}

function numberId(id: unknown): number | null {
  return id === undefined || id === null ? null : Number(id);
}
