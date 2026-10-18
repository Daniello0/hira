import type { HardConstraints } from '@hira/contracts';

export interface HardFilterSql {
  sql: string;
  params: unknown[];
}

/** SQL predicates shared by every branch. Parameters begin at `startAt`. */
export function hardFilterSql(filters: HardConstraints, startAt: number): HardFilterSql {
  const parts = ["v.status = 'ACTIVE'"];
  const params: unknown[] = [];
  let index = appendList(parts, params, startAt, 'v.work_format', 'work_format', filters.workFormat);
  index = appendList(parts, params, index, 'v.employment', 'employment_type', filters.employment);
  index = appendSalary(parts, params, index, filters.salaryMin);
  appendLocation(parts, params, index, filters.location);
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

function appendSalary(parts: string[], params: unknown[], index: number, salary: number | undefined): number {
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
): void {
  if (location === undefined || location.length === 0) return;
  params.push(location.map((place) => place.toLowerCase()));
  parts.push(locationPredicate(index));
}

function locationPredicate(index: number): string {
  const places = `$${index}::text[]`;
  return (
    `EXISTS (SELECT 1 FROM locations l WHERE l.id = v.location_id ` +
    `AND (lower(l.city) = ANY(${places}) OR lower(l.region) = ANY(${places})))`
  );
}
