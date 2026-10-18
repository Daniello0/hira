import { formatLocationLabel, type VacancyDto } from '@hira/contracts';
import type { Sql } from './typeorm-chat.sql';

/** Live cards for snapshot rows. A missing vacancy is omitted. */
export async function loadVacancyCards(sql: Sql, ids: string[]): Promise<Map<string, VacancyDto>> {
  if (ids.length === 0) return new Map();
  const rows = await sql.query(VACANCY_CARD_SQL, [ids]);
  const cards = new Map<string, VacancyDto>();
  if (!Array.isArray(rows)) return cards;
  for (const row of rows) {
    if (!isRecord(row)) continue;
    cards.set(String(row.id), toVacancyCard(row));
  }
  return cards;
}

/** Maps one vacancy row, including the company and place shown on the card. */
export function toVacancyCard(row: Record<string, unknown>): VacancyDto {
  return { ...identity(row), ...place(row), ...work(row), ...pay(row), ...flags(row) };
}

function identity(row: Record<string, unknown>): Pick<VacancyDto, 'id' | 'source' | 'language' | 'externalId' | 'url' | 'title' | 'companyId'> {
  return {
    id: String(row.id),
    source: String(row.source) as VacancyDto['source'],
    language: String(row.language).trim() as VacancyDto['language'],
    externalId: String(row.externalId),
    url: String(row.url ?? ''),
    title: String(row.title),
    companyId: textOrNull(row.companyId),
  };
}

function place(row: Record<string, unknown>): Pick<VacancyDto, 'companyName' | 'locationId' | 'locationLabel'> {
  return {
    companyName: companyName(row.companyName),
    locationId: asNumber(row.locationId),
    locationLabel: formatLocationLabel(textOrNull(row.locationCity), textOrNull(row.locationRegion)),
  };
}

function work(row: Record<string, unknown>): Pick<VacancyDto, 'description' | 'seniority' | 'employment' | 'workFormat' | 'schedule'> {
  return {
    description: String(row.description ?? ''),
    seniority: textOrNull(row.seniority) as VacancyDto['seniority'],
    employment: textOrNull(row.employment) as VacancyDto['employment'],
    workFormat: textOrNull(row.workFormat) as VacancyDto['workFormat'],
    schedule: textOrNull(row.schedule),
  };
}

function pay(row: Record<string, unknown>): Pick<VacancyDto, 'salaryMin' | 'salaryMax' | 'salaryCurrency' | 'salaryMinByn' | 'salaryMaxByn' | 'isGross' | 'rateAmount' | 'rateUnit' | 'projectDurationDays'> {
  return {
    salaryMin: asNumber(row.salaryMin),
    salaryMax: asNumber(row.salaryMax),
    salaryCurrency: textOrNull(row.salaryCurrency),
    salaryMinByn: asNumber(row.salaryMinByn),
    salaryMaxByn: asNumber(row.salaryMaxByn),
    isGross: row.isGross === null || row.isGross === undefined ? null : row.isGross === true,
    rateAmount: asNumber(row.rateAmount),
    rateUnit: textOrNull(row.rateUnit) as VacancyDto['rateUnit'],
    projectDurationDays: asNumber(row.projectDurationDays),
  };
}

function flags(row: Record<string, unknown>): Pick<VacancyDto, 'isForeignRemote' | 'status' | 'publishedAt'> {
  return {
    isForeignRemote: row.isForeignRemote === true,
    status: String(row.status) as VacancyDto['status'],
    publishedAt: publishedAt(row.publishedAt),
  };
}

function publishedAt(value: unknown): string {
  if (value === null || value === undefined) return '';
  return new Date(String(value)).toISOString();
}

function companyName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
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

export const VACANCY_CARD_SQL = `SELECT v.id::text AS id, v.source, v.language, v.external_id AS "externalId",
  v.url, v.title, v.company_id::text AS "companyId", v.company_name AS "companyName",
  v.location_id AS "locationId", l.city AS "locationCity", l.region AS "locationRegion", v.description,
  v.seniority, v.employment, v.work_format AS "workFormat", v.schedule,
  v.salary_min AS "salaryMin", v.salary_max AS "salaryMax", v.salary_currency AS "salaryCurrency",
  v.salary_min_byn AS "salaryMinByn", v.salary_max_byn AS "salaryMaxByn", v.is_gross AS "isGross",
  v.rate_amount AS "rateAmount", v.rate_unit AS "rateUnit", v.project_duration_days AS "projectDurationDays",
  v.is_foreign_remote AS "isForeignRemote", v.status, v.published_at AS "publishedAt"
  FROM vacancies v
  LEFT JOIN locations l ON l.id = v.location_id
  WHERE v.id = ANY($1::uuid[])`;
