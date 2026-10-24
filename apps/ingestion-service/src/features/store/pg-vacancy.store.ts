import type { SqlClient } from './sql-client';
import { DuplicateDetection, VacancyStatus } from '@hira/contracts';
import { crossSourceDecision } from '../dedupe/cross-source';
import { fuzzySimilarity, simhash } from '../dedupe/simhash';
import { conditionsText, contentHash, sourceHash } from '../normalize/content-hash';
import { flattenWhitespace } from '../normalize/strip-html';
import type { CanonicalVacancy } from '../normalize/normalize-vacancy';
import { resolveCompanyId } from './pg-company';
import { resolveLocationId } from './pg-location';

export interface SaveResult {
  outcome: 'created' | 'skipped' | 'updated';
  id: string;
}

interface ExistingVacancy {
  id: string;
  contentHash: string;
  skillsText: string;
  title: string;
  description: string;
  workFormat: string | null;
  schedule: string | null;
}

/** Writes vacancies with parameterized SQL. Migrations stay in core-api. */
export function createPgVacancyStore(client: SqlClient): {
  save(vacancy: CanonicalVacancy, seenAt: Date): Promise<SaveResult>;
} {
  return { save: (vacancy, seenAt) => saveVacancy(client, vacancy, seenAt) };
}

async function saveVacancy(
  client: SqlClient,
  vacancy: CanonicalVacancy,
  seenAt: Date,
): Promise<SaveResult> {
  await client.query('BEGIN');
  try {
    const result = await writeVacancy(client, vacancy, seenAt);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function writeVacancy(
  client: SqlClient,
  vacancy: CanonicalVacancy,
  seenAt: Date,
): Promise<SaveResult> {
  const companyId = await resolveCompanyId(client, vacancy);
  const locationId = await resolveLocationId(client, vacancy);
  const result = await upsertVacancy(client, vacancy, companyId, locationId, seenAt);
  if (result.outcome !== 'skipped' && vacancy.status === VacancyStatus.Active) {
    await hideCopy(client, vacancy, result.id);
  }
  return result;
}

async function upsertVacancy(
  client: SqlClient,
  vacancy: CanonicalVacancy,
  companyId: string,
  locationId: number | null,
  seenAt: Date,
): Promise<SaveResult> {
  const existing = await findVacancy(client, vacancy);
  if (existing === null) {
    const id = await insertVacancy(client, vacancy, companyId, locationId, seenAt);
    return { outcome: 'created', id };
  }
  if (sameSource(existing, vacancy)) {
    return touchUnchanged(client, existing.id, vacancy.status, seenAt);
  }
  if (sameSource(flatText(existing), flatText(vacancy))) {
    return refreshLayout(client, existing, vacancy, seenAt);
  }
  await replaceStoredText(client, existing.id);
  await updateVacancy(client, existing.id, vacancy, companyId, locationId, seenAt);
  return { outcome: 'updated', id: existing.id };
}

async function replaceStoredText(client: SqlClient, id: string): Promise<void> {
  await client.query(`SELECT id FROM vacancies WHERE id = $1 FOR UPDATE`, [id]);
  await client.query(`DELETE FROM vacancy_skills WHERE vacancy_id = $1`, [id]);
  await client.query(`DELETE FROM vacancy_chunks WHERE vacancy_id = $1`, [id]);
}

type SourceText = Parameters<typeof textOf>[0];

function sameSource(existing: SourceText, vacancy: SourceText): boolean {
  return sourceHash(textOf(existing)) === sourceHash(textOf(vacancy));
}

function flatText<T extends SourceText>(row: T): SourceText {
  return { ...row, description: flattenWhitespace(row.description) };
}

/**
 * Same words, new line breaks: rows stored before block tags kept their breaks. The text and
 * the chunks are refreshed; extracted skills and the vacancy vector stay, so no LLM call follows.
 */
async function refreshLayout(
  client: SqlClient,
  existing: ExistingVacancy,
  vacancy: CanonicalVacancy,
  seenAt: Date,
): Promise<SaveResult> {
  await client.query(`SELECT id FROM vacancies WHERE id = $1 FOR UPDATE`, [existing.id]);
  await client.query(`DELETE FROM vacancy_chunks WHERE vacancy_id = $1`, [existing.id]);
  const hash = contentHash({
    title: vacancy.title,
    description: vacancy.description,
    skillsText: existing.skillsText,
    conditions: conditionsText(vacancy.workFormat, vacancy.schedule),
  });
  await client.query(LAYOUT_SQL, [
    existing.id,
    vacancy.description,
    vacancy.descriptionRaw,
    seenAt,
    hash,
    vacancy.status,
  ]);
  return { outcome: 'updated', id: existing.id };
}

const LAYOUT_SQL = `UPDATE vacancies SET description = $2, description_raw = $3,
  last_seen_at = $4, content_hash = $5, status = $6
WHERE id = $1`;

function textOf(row: {
  title: string;
  description: string;
  workFormat: string | null;
  schedule: string | null;
}): { title: string; description: string; conditions: string } {
  return {
    title: row.title,
    description: row.description,
    conditions: conditionsText(row.workFormat, row.schedule),
  };
}

async function touchUnchanged(
  client: SqlClient,
  id: string,
  status: CanonicalVacancy['status'],
  seenAt: Date,
): Promise<SaveResult> {
  if (status !== VacancyStatus.Closed) {
    await client.query(`UPDATE vacancies SET last_seen_at = $2 WHERE id = $1`, [id, seenAt]);
    return { outcome: 'skipped', id };
  }
  await client.query(`UPDATE vacancies SET last_seen_at = $2, status = $3 WHERE id = $1`, [
    id,
    seenAt,
    status,
  ]);
  return { outcome: 'updated', id };
}

async function findVacancy(
  client: SqlClient,
  vacancy: CanonicalVacancy,
): Promise<ExistingVacancy | null> {
  const result = await client.query(
    `SELECT id::text AS id, content_hash AS "contentHash", title, description,
            work_format AS "workFormat", schedule, skills_text AS "skillsText"
     FROM vacancies
     WHERE source = $1 AND external_id = $2`,
    [vacancy.source, vacancy.externalId],
  );
  return readExisting(result.rows[0]);
}

function readExisting(row: Record<string, unknown> | undefined): ExistingVacancy | null {
  if (row === undefined) return null;
  return {
    id: String(row.id),
    contentHash: String(row.contentHash ?? '').trim(),
    skillsText: String(row.skillsText ?? ''),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    workFormat: row.workFormat == null ? null : String(row.workFormat),
    schedule: row.schedule == null ? null : String(row.schedule),
  };
}

async function hideCopy(client: SqlClient, vacancy: CanonicalVacancy, id: string): Promise<void> {
  const result = await client.query(
    `SELECT v.id::text AS id, v.source::text AS source, v.title, v.description, l.city,
            c.normalized_name AS "companyName"
     FROM vacancies v
     JOIN companies c ON c.id = v.company_id
     LEFT JOIN locations l ON l.id = v.location_id
     WHERE v.status = 'ACTIVE' AND v.id <> $1 AND c.normalized_name = $2`,
    [id, vacancy.companyName],
  );
  const match = result.rows.map(readCandidate).find((row) => isCopy(vacancy, row));
  if (match === undefined) return;
  await markDuplicate(client, String(match.id), id, copyScore(vacancy, match));
}

function isCopy(vacancy: CanonicalVacancy, row: CandidateRow): boolean {
  return crossSourceDecision({
    incoming: vacancy,
    existing: {
      id: row.id,
      source: row.source,
      companyName: row.companyName,
      title: row.title,
      city: row.city,
      simhash: simhash(row.description ?? ''),
      status: VacancyStatus.Active,
    },
  }).duplicate;
}

function copyScore(vacancy: CanonicalVacancy, match: CandidateRow): number {
  return fuzzySimilarity(vacancy.simhash, simhash(match.description ?? ''));
}

async function markDuplicate(
  client: SqlClient,
  canonicalId: string,
  duplicateId: string,
  similarity: number,
): Promise<void> {
  await client.query(`UPDATE vacancies SET status = 'DUPLICATE' WHERE id = $1`, [duplicateId]);
  await client.query(
    `INSERT INTO vacancy_duplicates (canonical_vacancy_id, duplicate_vacancy_id, similarity, detected_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (canonical_vacancy_id, duplicate_vacancy_id)
     DO UPDATE SET similarity = EXCLUDED.similarity`,
    [canonicalId, duplicateId, similarity, DuplicateDetection.Fuzzy],
  );
}

function readCandidate(row: Record<string, unknown>): CandidateRow {
  return {
    id: String(row.id),
    source: String(row.source) as CandidateRow['source'],
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    city: row.city == null ? null : String(row.city),
    companyName: String(row.companyName),
  };
}

interface CandidateRow {
  id: string;
  source: CanonicalVacancy['source'];
  title: string;
  description: string | null;
  city: string | null;
  companyName: string;
}

async function insertVacancy(
  client: SqlClient,
  vacancy: CanonicalVacancy,
  companyId: string,
  locationId: number | null,
  seenAt: Date,
): Promise<string> {
  const result = await client.query(
    INSERT_SQL,
    insertParams(vacancy, companyId, locationId, seenAt),
  );
  return String(result.rows[0]?.id);
}

async function updateVacancy(
  client: SqlClient,
  id: string,
  vacancy: CanonicalVacancy,
  companyId: string,
  locationId: number | null,
  seenAt: Date,
): Promise<void> {
  await client.query(UPDATE_SQL, [
    id,
    ...contentParams(vacancy, companyId, locationId),
    seenAt,
    vacancy.contentHash,
  ]);
}

function insertParams(
  vacancy: CanonicalVacancy,
  companyId: string,
  locationId: number | null,
  seenAt: Date,
): unknown[] {
  return [...contentParams(vacancy, companyId, locationId), seenAt, seenAt, vacancy.contentHash];
}

function contentParams(
  vacancy: CanonicalVacancy,
  companyId: string,
  locationId: number | null,
): unknown[] {
  return [
    vacancy.source,
    vacancy.language,
    vacancy.externalId,
    vacancy.url,
    vacancy.title,
    companyId,
    locationId,
    vacancy.description,
    vacancy.descriptionRaw,
    vacancy.seniority,
    vacancy.employment,
    vacancy.workFormat,
    vacancy.schedule,
    vacancy.salaryMin,
    vacancy.salaryMax,
    vacancy.salaryCurrency,
    vacancy.salaryMinByn,
    vacancy.salaryMaxByn,
    vacancy.isGross,
    vacancy.isForeignRemote,
    vacancy.status,
    vacancy.publishedAt,
    vacancy.companyDisplayName,
    vacancy.rateAmount,
    vacancy.rateUnit,
    vacancy.projectDurationDays,
  ];
}

const INSERT_SQL = `INSERT INTO vacancies (
  source, language, external_id, url, title, company_id, location_id,
  description, description_raw, seniority, employment, work_format, schedule,
  salary_min, salary_max, salary_currency, salary_min_byn, salary_max_byn, is_gross,
  is_foreign_remote, status, published_at, company_name, rate_amount, rate_unit, project_duration_days,
  first_seen_at, last_seen_at, content_hash, skills_text
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
  $27,$28,$29,''
) RETURNING id::text AS id`;

const UPDATE_SQL = `UPDATE vacancies SET
  source = $2, language = $3, external_id = $4, url = $5, title = $6, company_id = $7,
  location_id = $8, description = $9, description_raw = $10, seniority = $11, employment = $12,
  work_format = $13, schedule = $14, salary_min = $15, salary_max = $16, salary_currency = $17,
  salary_min_byn = $18, salary_max_byn = $19, is_gross = $20, is_foreign_remote = $21, status = $22,
  published_at = $23, company_name = $24, rate_amount = $25, rate_unit = $26,
  project_duration_days = $27, last_seen_at = $28, content_hash = $29,
  skills_text = '', embedding = NULL, skills_extracted_at = NULL, skill_extract_failures = 0
WHERE id = $1`;
