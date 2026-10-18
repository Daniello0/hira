import {
  formatLocationLabel,
  type EmploymentType,
  type Language,
  type RateUnit,
  type SeniorityLevel,
  type VacancyDto,
  type VacancySource,
  type VacancyStatus,
  type WorkFormat,
} from '@hira/contracts';
import type { SqlClient } from './sql-client';

/** Card fields plus the lexical document the reranker reads. */
export interface LoadedVacancy {
  vacancy: VacancyDto;
  searchDocument: string;
  seniority: SeniorityLevel | null;
}

/** Loads cards in the requested id order. */
export async function loadVacancies(
  client: SqlClient,
  ids: readonly string[],
): Promise<LoadedVacancy[]> {
  if (ids.length === 0) return [];
  const result = await client.query(VACANCY_SQL, [ids]);
  const byId = new Map(result.rows.map((row) => [String(row.id), readLoaded(row)]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row === undefined ? [] : [row];
  });
}

function readLoaded(row: Record<string, unknown>): LoadedVacancy {
  const seniority = textOrNull(row.seniority) as SeniorityLevel | null;
  return {
    vacancy: readVacancy(row, seniority),
    searchDocument: String(row.searchDocument ?? ''),
    seniority,
  };
}

function readVacancy(row: Record<string, unknown>, seniority: SeniorityLevel | null): VacancyDto {
  return {
    ...identityOf(row),
    ...placeOf(row),
    ...textOf(row, seniority),
    ...payOf(row),
    isForeignRemote: row.isForeignRemote === true,
    status: String(row.status) as VacancyStatus,
    publishedAt: publishedAt(row.publishedAt),
  };
}

function identityOf(
  row: Record<string, unknown>,
): Pick<
  VacancyDto,
  'id' | 'source' | 'language' | 'externalId' | 'url' | 'title' | 'companyId' | 'locationId'
> {
  return {
    id: String(row.id),
    source: String(row.source) as VacancySource,
    language: String(row.language).trim() as Language,
    externalId: String(row.externalId),
    url: String(row.url ?? ''),
    title: String(row.title),
    companyId: textOrNull(row.companyId),
    locationId: asNumber(row.locationId),
  };
}

function placeOf(row: Record<string, unknown>): Pick<VacancyDto, 'companyName' | 'locationLabel'> {
  return {
    companyName: companyName(row.companyName),
    locationLabel: formatLocationLabel(textOrNull(row.locationCity), textOrNull(row.locationRegion)),
  };
}

function companyName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function textOf(
  row: Record<string, unknown>,
  seniority: SeniorityLevel | null,
): Pick<VacancyDto, 'description' | 'seniority' | 'employment' | 'workFormat' | 'schedule'> {
  return {
    description: String(row.description ?? ''),
    seniority,
    employment: textOrNull(row.employment) as EmploymentType | null,
    workFormat: textOrNull(row.workFormat) as WorkFormat | null,
    schedule: textOrNull(row.schedule),
  };
}

type PayFields = Pick<
  VacancyDto,
  | 'salaryMin'
  | 'salaryMax'
  | 'salaryCurrency'
  | 'salaryMinByn'
  | 'salaryMaxByn'
  | 'isGross'
  | 'rateAmount'
  | 'rateUnit'
  | 'projectDurationDays'
>;

function payOf(row: Record<string, unknown>): PayFields {
  return {
    salaryMin: asNumber(row.salaryMin),
    salaryMax: asNumber(row.salaryMax),
    salaryCurrency: textOrNull(row.salaryCurrency),
    salaryMinByn: asNumber(row.salaryMinByn),
    salaryMaxByn: asNumber(row.salaryMaxByn),
    isGross: row.isGross === null || row.isGross === undefined ? null : row.isGross === true,
    rateAmount: asNumber(row.rateAmount),
    rateUnit: textOrNull(row.rateUnit) as RateUnit | null,
    projectDurationDays: asNumber(row.projectDurationDays),
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

export const VACANCY_SQL = `SELECT v.id::text AS id, v.source, v.language, v.external_id AS "externalId",
    v.url, v.title, v.company_id::text AS "companyId", v.company_name AS "companyName",
    v.location_id AS "locationId", l.city AS "locationCity", l.region AS "locationRegion",
    v.description, v.seniority, v.employment, v.work_format AS "workFormat", v.schedule,
    v.salary_min AS "salaryMin", v.salary_max AS "salaryMax", v.salary_currency AS "salaryCurrency",
    v.salary_min_byn AS "salaryMinByn", v.salary_max_byn AS "salaryMaxByn", v.is_gross AS "isGross",
    v.rate_amount AS "rateAmount", v.rate_unit AS "rateUnit",
    v.project_duration_days AS "projectDurationDays", v.is_foreign_remote AS "isForeignRemote",
    v.status, v.published_at AS "publishedAt", v.search_document AS "searchDocument"
  FROM vacancies v
  LEFT JOIN locations l ON l.id = v.location_id
  WHERE v.id = ANY($1::uuid[])`;
