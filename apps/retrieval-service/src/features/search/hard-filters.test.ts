import { EmploymentType, WorkFormat } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { hardFilterSql } from './hard-filters';

describe('hardFilterSql', () => {
  it('keeps only active vacancies when no constraint is set', () => {
    const filter = hardFilterSql({}, 2);
    expect(filter.sql).toContain("v.status = 'ACTIVE'");
    expect(filter.params).toEqual([]);
  });

  it('matches work format and employment as arrays', () => {
    const filter = hardFilterSql(
      { workFormat: [WorkFormat.Remote], employment: [EmploymentType.FullTime] },
      2,
    );
    expect(filter.sql).toContain('v.work_format = ANY($2::work_format[])');
    expect(filter.sql).toContain('v.employment = ANY($3::employment_type[])');
    expect(filter.params).toEqual([[WorkFormat.Remote], [EmploymentType.FullTime]]);
  });

  it('ignores empty constraint lists and keeps a salary floor of zero', () => {
    const empty = hardFilterSql({ workFormat: [], employment: [], location: [] }, 2);
    expect(empty.sql).not.toContain('work_format');
    expect(empty.params).toEqual([]);
    const floor = hardFilterSql({ salaryMin: 0 }, 2);
    expect(floor.sql).toContain('v.salary_max_byn >= $2');
    expect(floor.sql).toContain('v.salary_max_byn IS NULL AND v.salary_min_byn >= $2');
    expect(floor.params).toEqual([0]);
  });

  it('matches a location against city or region without case', () => {
    const filter = hardFilterSql({ location: ['Minsk', 'МИНСК'] }, 4);
    expect(filter.sql).toContain('v.location_id');
    expect(filter.sql).toContain('lower(l.city) = ANY($4::text[])');
    expect(filter.sql).toContain('lower(l.region) = ANY($4::text[])');
    expect(filter.params).toEqual([['minsk', 'минск']]);
  });
});
