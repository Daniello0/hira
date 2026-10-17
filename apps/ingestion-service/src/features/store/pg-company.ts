import type { CanonicalVacancy } from '../normalize/normalize-vacancy';
import type { SqlClient } from './sql-client';

/** Finds a company by UNP, then by the normalized name. */
export async function resolveCompanyId(
  client: SqlClient,
  vacancy: CanonicalVacancy,
): Promise<string> {
  const existing = await findCompanyId(client, vacancy);
  if (existing !== null) return existing;
  const inserted = await client.query(
    `INSERT INTO companies (name, normalized_name, unp) VALUES ($1, $2, $3) RETURNING id::text AS id`,
    [vacancy.companyDisplayName, vacancy.companyName, vacancy.unp],
  );
  return textId(inserted.rows[0]);
}

async function findCompanyId(client: SqlClient, vacancy: CanonicalVacancy): Promise<string | null> {
  if (vacancy.unp !== null) {
    const byUnp = await client.query(
      `SELECT id::text AS id FROM companies WHERE unp = $1 LIMIT 1`,
      [vacancy.unp],
    );
    if (byUnp.rows[0] !== undefined) return textId(byUnp.rows[0]);
  }
  const byName = await client.query(
    `SELECT id::text AS id FROM companies WHERE normalized_name = $1 LIMIT 1`,
    [vacancy.companyName],
  );
  return byName.rows[0] === undefined ? null : textId(byName.rows[0]);
}

function textId(row: Record<string, unknown> | undefined): string {
  return String(row?.id ?? '');
}
