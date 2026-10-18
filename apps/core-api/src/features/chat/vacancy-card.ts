import type { VacancyDto } from '@hira/contracts';
import type { Sql } from './typeorm-chat.sql';

/** Live cards for snapshot rows. A missing vacancy is omitted. */
export async function loadVacancyCards(sql: Sql, ids: string[]): Promise<Map<string, VacancyDto>> {
  if (ids.length === 0) return new Map();
  const rows = await sql.query(VACANCY_SQL, [ids]);
  const cards = new Map<string, VacancyDto>();
  if (!Array.isArray(rows)) return cards;
  for (const row of rows) {
    if (!isRecord(row)) continue;
    cards.set(String(row.id), toCard(row));
  }
  return cards;
}

function toCard(row: Record<string, unknown>): VacancyDto {
  return {
    id: String(row.id),
    source: String(row.source) as VacancyDto['source'],
    language: String(row.language).trim() as VacancyDto['language'],
    externalId: String(row.externalId),
    url: String(row.url ?? ''),
    title: String(row.title),
    companyId: textOrNull(row.companyId),
    locationId: asNumber(row.locationId),
    description: String(row.description ?? ''),
    seniority: textOrNull(row.seniority) as VacancyDto['seniority'],
    employment: textOrNull(row.employment) as VacancyDto['employment'],
    workFormat: textOrNull(row.workFormat) as VacancyDto['workFormat'],
    schedule: textOrNull(row.schedule),
    salaryMin: asNumber(row.salaryMin),
    salaryMax: asNumber(row.salaryMax),
    salaryCurrency: textOrNull(row.salaryCurrency),
    salaryMinByn: asNumber(row.salaryMinByn),
    salaryMaxByn: asNumber(row.salaryMaxByn),
    isGross: row.isGross === null || row.isGross === undefined ? null : row.isGross === true,
    rateAmount: asNumber(row.rateAmount),
    rateUnit: textOrNull(row.rateUnit) as VacancyDto['rateUnit'],
    projectDurationDays: asNumber(row.projectDurationDays),
    isForeignRemote: row.isForeignRemote === true,
    status: String(row.status) as VacancyDto['status'],
    publishedAt: publishedAt(row.publishedAt),
  };
}

function publishedAt(value: unknown): string {
  if (value === null || value === undefined) return '';
  return new Date(String(value)).toISOString();
}

function textOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length === 0 ? null : text;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const VACANCY_SQL = `SELECT id::text AS id, source, language, external_id AS "externalId",
  url, title, company_id::text AS "companyId", location_id AS "locationId", description,
  seniority, employment, work_format AS "workFormat", schedule,
  salary_min AS "salaryMin", salary_max AS "salaryMax", salary_currency AS "salaryCurrency",
  salary_min_byn AS "salaryMinByn", salary_max_byn AS "salaryMaxByn", is_gross AS "isGross",
  rate_amount AS "rateAmount", rate_unit AS "rateUnit", project_duration_days AS "projectDurationDays",
  is_foreign_remote AS "isForeignRemote", status, published_at AS "publishedAt"
  FROM vacancies WHERE id = ANY($1::uuid[])`;
