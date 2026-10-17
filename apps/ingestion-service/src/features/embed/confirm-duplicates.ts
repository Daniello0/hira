import { DuplicateDetection, VacancyStatus, type VacancySource } from '@hira/contracts';
import { DUPLICATE_COSINE_THRESHOLD } from '../ingestion.constants';
import { crossSourceDecision } from '../dedupe/cross-source';
import { simhash } from '../dedupe/simhash';
import type { SqlClient } from '../store/sql-client';

/** Marks cross-source copies whose embeddings meet the cosine threshold. */
export async function confirmEmbeddingDuplicates(client: SqlClient): Promise<number> {
  const result = await client.query(PAIR_SQL, [DUPLICATE_COSINE_THRESHOLD]);
  let marked = 0;
  for (const row of result.rows) {
    if (await markPair(client, row)) marked += 1;
  }
  return marked;
}

async function markPair(client: SqlClient, row: Record<string, unknown>): Promise<boolean> {
  const pair = readPair(row);
  const decision = decidePair(pair);
  if (decision === null) return false;
  await writeDuplicate(client, decision.canonicalId, pair.later.id, pair.cosine, decision.detectedBy);
  return true;
}

function decidePair(pair: { earlier: Side; later: Side; cosine: number }) {
  const decision = crossSourceDecision({
    incoming: side(pair.later),
    existing: { ...side(pair.earlier), id: pair.earlier.id, status: VacancyStatus.Active },
    cosine: pair.cosine,
  });
  if (!decision.duplicate || decision.canonicalId === undefined || decision.detectedBy === undefined) {
    return null;
  }
  return { canonicalId: decision.canonicalId, detectedBy: decision.detectedBy };
}

async function writeDuplicate(
  client: SqlClient,
  canonicalId: string,
  duplicateId: string,
  cosine: number,
  detectedBy: DuplicateDetection,
): Promise<void> {
  await client.query(`UPDATE vacancies SET status = 'DUPLICATE' WHERE id = $1`, [duplicateId]);
  await client.query(
    `INSERT INTO vacancy_duplicates (canonical_vacancy_id, duplicate_vacancy_id, similarity, detected_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (canonical_vacancy_id, duplicate_vacancy_id)
     DO UPDATE SET similarity = EXCLUDED.similarity, detected_by = EXCLUDED.detected_by`,
    [canonicalId, duplicateId, cosine, detectedBy],
  );
}

function readPair(row: Record<string, unknown>): { earlier: Side; later: Side; cosine: number } {
  const left = readSide(row, 'left');
  const right = readSide(row, 'right');
  const earlier = earlierSide(row) === 'left' ? left : right;
  return { earlier, later: earlier === left ? right : left, cosine: Number(row.cosine) };
}

function earlierSide(row: Record<string, unknown>): 'left' | 'right' {
  const seen = compareTime(row.leftSeen, row.rightSeen);
  if (seen !== 0) return seen < 0 ? 'left' : 'right';
  const created = compareTime(row.leftCreated, row.rightCreated);
  if (created !== 0) return created < 0 ? 'left' : 'right';
  return String(row.leftId) < String(row.rightId) ? 'left' : 'right';
}

function compareTime(left: unknown, right: unknown): number {
  return instant(left) - instant(right);
}

function instant(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  return new Date(String(value)).getTime();
}

function readSide(row: Record<string, unknown>, prefix: 'left' | 'right'): Side {
  return {
    id: String(row[`${prefix}Id`]),
    source: String(row[`${prefix}Source`]) as VacancySource,
    title: String(row[`${prefix}Title`]),
    description: String(row[`${prefix}Description`] ?? ''),
    city: row[`${prefix}City`] == null ? null : String(row[`${prefix}City`]),
    companyName: String(row.company),
  };
}

function side(row: Side) {
  return {
    source: row.source,
    companyName: row.companyName,
    title: row.title,
    city: row.city,
    simhash: simhash(row.description),
  };
}

interface Side {
  id: string;
  source: VacancySource;
  title: string;
  description: string;
  city: string | null;
  companyName: string;
}

const PAIR_SQL = `SELECT a.id::text AS "leftId", b.id::text AS "rightId",
  a.source::text AS "leftSource", b.source::text AS "rightSource",
  a.title AS "leftTitle", b.title AS "rightTitle",
  a.description AS "leftDescription", b.description AS "rightDescription",
  la.city AS "leftCity", lb.city AS "rightCity",
  ca.normalized_name AS company,
  a.first_seen_at AS "leftSeen", b.first_seen_at AS "rightSeen",
  a.created_at AS "leftCreated", b.created_at AS "rightCreated",
  1 - (a.embedding <=> b.embedding) AS cosine
  FROM vacancies a
  JOIN vacancies b ON a.id < b.id
  JOIN companies ca ON ca.id = a.company_id
  JOIN companies cb ON cb.id = b.company_id
  LEFT JOIN locations la ON la.id = a.location_id
  LEFT JOIN locations lb ON lb.id = b.location_id
  WHERE a.status = 'ACTIVE' AND b.status = 'ACTIVE'
    AND a.source <> b.source
    AND ca.normalized_name = cb.normalized_name
    AND lower(trim(a.title)) = lower(trim(b.title))
    AND la.city IS NOT NULL AND lower(la.city) = lower(lb.city)
    AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
    AND 1 - (a.embedding <=> b.embedding) >= $1`;
