import type { HardConstraints } from '@hira/contracts';

export interface HardFilterSql {
  sql: string;
  params: unknown[];
}

/** Hard constraints plus the soft constraints still in force during S3 relaxation. */
export interface SearchFilters extends HardConstraints {
  /** Each term must occur in the vacancy text (full-text match in the vacancy language). */
  softTerms?: readonly string[];
}

/** SQL predicates shared by every branch. Parameters begin at `startAt`. */
export function hardFilterSql(filters: SearchFilters, startAt: number): HardFilterSql {
  const parts = ["v.status = 'ACTIVE'"];
  const params: unknown[] = [];
  let index = appendList(
    parts,
    params,
    startAt,
    'v.work_format',
    'work_format',
    filters.workFormat,
  );
  index = appendList(parts, params, index, 'v.employment', 'employment_type', filters.employment);
  index = appendSalary(parts, params, index, filters.salaryMin);
  index = appendLocation(parts, params, index, filters.location);
  if (filters.includeForeignRemote === false) parts.push('v.is_foreign_remote = false');
  appendSoftTerms(parts, params, index, filters.softTerms);
  return { sql: parts.join(' AND '), params };
}

function appendList(
  parts: string[],
  params: unknown[],
  index: number,
  column: string,
  pgType: string,
  values: readonly string[] | undefined,
): number {
  if (values === undefined || values.length === 0) return index;
  params.push([...values]);
  parts.push(`${column} = ANY($${index}::${pgType}[])`);
  return index + 1;
}

function appendSalary(
  parts: string[],
  params: unknown[],
  index: number,
  salary: number | undefined,
): number {
  if (salary === undefined) return index;
  params.push(salary);
  parts.push(salaryPredicate(index));
  return index + 1;
}

function salaryPredicate(index: number): string {
  const floor = `$${index}`;
  return `(v.salary_max_byn >= ${floor} OR (v.salary_max_byn IS NULL AND v.salary_min_byn >= ${floor}))`;
}

function appendLocation(
  parts: string[],
  params: unknown[],
  index: number,
  location: readonly string[] | undefined,
): number {
  if (location === undefined || location.length === 0) return index;
  params.push(location.map((place) => place.toLowerCase()));
  parts.push(locationPredicate(index));
  return index + 1;
}

function locationPredicate(index: number): string {
  const places = `$${index}::text[]`;
  return (
    `EXISTS (SELECT 1 FROM locations l WHERE l.id = v.location_id ` +
    `AND (lower(l.city) = ANY(${places}) OR lower(l.region) = ANY(${places})))`
  );
}

function appendSoftTerms(
  parts: string[],
  params: unknown[],
  index: number,
  terms: readonly string[] | undefined,
): void {
  (terms ?? []).forEach((term, offset) => {
    params.push(term);
    parts.push(softTermPredicate(index + offset));
  });
}

const VACANCY_TEXT_CONFIG =
  "CASE WHEN v.language = 'en' THEN 'english'::regconfig ELSE 'russian'::regconfig END";

function softTermPredicate(index: number): string {
  return (
    `to_tsvector(${VACANCY_TEXT_CONFIG}, v.search_document) ` +
    `@@ plainto_tsquery(${VACANCY_TEXT_CONFIG}, $${index})`
  );
}
