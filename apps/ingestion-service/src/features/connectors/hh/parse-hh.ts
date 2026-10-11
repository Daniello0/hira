import { HH_AREA_BELARUS, HH_MAX_RESULTS_PER_QUERY, HH_PAGE_SIZE } from '../../ingestion.constants';
import { isRecord } from '../record';
import type { RawVacancy, RawVacancyRef } from '../raw-vacancy';

export interface HhListPage {
  refs: RawVacancyRef[];
  found: number;
  pages: number;
}

/** True when one HeadHunter query cannot return every hit. */
export function hhListIsTruncated(found: number): boolean {
  return found > HH_MAX_RESULTS_PER_QUERY;
}

/** Search path limited to Belarus. */
export function buildHhListPath(input: {
  page: number;
  dateFrom?: string;
  dateTo?: string;
}): string {
  const params = new URLSearchParams({
    area: String(HH_AREA_BELARUS),
    per_page: String(HH_PAGE_SIZE),
    page: String(input.page),
  });
  if (input.dateFrom !== undefined) params.set('date_from', input.dateFrom);
  if (input.dateTo !== undefined) params.set('date_to', input.dateTo);
  return `/vacancies?${params.toString()}`;
}

/** Reads ids from a search response. A forbidden body is an error, not an empty list. */
export function parseHhList(body: unknown): HhListPage {
  const record = requiredRecord(body);
  rejectUpstreamError(record);
  return {
    refs: readRefs(record.items),
    found: typeof record.found === 'number' ? record.found : 0,
    pages: typeof record.pages === 'number' ? record.pages : 0,
  };
}

/** Maps one HeadHunter vacancy document onto the raw posting. */
export function parseHhVacancy(body: unknown): RawVacancy {
  const record = requiredRecord(body);
  const id = readId(record.id);
  return {
    externalId: id,
    url: readString(record.alternate_url),
    title: readString(record.name) ?? '',
    companyName: nestedName(record.employer) ?? '',
    unp: null,
    region: null,
    city: nestedName(record.area),
    descriptionHtml: readString(record.description) ?? '',
    seniorityRaw: nestedName(record.experience),
    employmentRaw: nestedName(record.employment),
    workFormatRaw: nestedName(record.schedule),
    schedule: nestedName(record.schedule),
    ...readSalary(record.salary),
    publishedAt: readString(record.published_at),
    archived: record.archived === true,
  };
}

function requiredRecord(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) throw new Error('HeadHunter body is not an object');
  return body;
}

function rejectUpstreamError(body: Record<string, unknown>): void {
  if (!Array.isArray(body.errors)) return;
  const first = body.errors[0];
  const type = isRecord(first) && typeof first.type === 'string' ? first.type : 'rejected';
  throw new Error(`HeadHunter ${type}`);
}

function readRefs(items: unknown): RawVacancyRef[] {
  if (!Array.isArray(items)) throw new Error('HeadHunter list has no items');
  return items.map((item) => ({ externalId: readItemId(item) }));
}

function readItemId(item: unknown): string {
  if (!isRecord(item)) throw new Error('HeadHunter item has no id');
  return readId(item.id);
}

function readId(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.length > 0) return value;
  throw new Error('HeadHunter item has no id');
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function nestedName(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return readString(value.name);
}

function readSalary(
  value: unknown,
): Pick<RawVacancy, 'salaryMin' | 'salaryMax' | 'salaryCurrency' | 'isGross'> {
  if (!isRecord(value)) {
    return { salaryMin: null, salaryMax: null, salaryCurrency: null, isGross: null };
  }
  return {
    salaryMin: readAmount(value.from),
    salaryMax: readAmount(value.to),
    salaryCurrency: readString(value.currency),
    isGross: typeof value.gross === 'boolean' ? value.gross : null,
  };
}

function readAmount(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}
