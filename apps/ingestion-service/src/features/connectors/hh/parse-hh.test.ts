import { describe, expect, it } from 'vitest';
import { HH_AREA_BELARUS, HH_MAX_RESULTS_PER_QUERY } from '../../ingestion.constants';
import { buildHhListPath, hhListIsTruncated, parseHhList, parseHhVacancy } from './parse-hh';
import { nextDateShards } from './shard-dates';

const LIST = {
  found: 12000,
  pages: 20,
  items: [
    {
      id: '55',
      name: 'Backend',
      alternate_url: 'https://rabota.by/vacancy/55',
      area: { name: 'Минск' },
      employer: { name: 'ООО Рога' },
    },
  ],
};

const DETAIL = {
  id: '55',
  name: 'Backend',
  archived: true,
  alternate_url: 'https://rabota.by/vacancy/55',
  description: '<p>API</p>',
  area: { name: 'Минск' },
  employer: { name: 'ООО Рога' },
  salary: { from: 2000, to: null, currency: 'BYN', gross: false },
  experience: { id: 'noExperience', name: 'Нет опыта' },
  employment: { name: 'Полная занятость' },
  schedule: { id: 'remote', name: 'Удаленная работа' },
  published_at: '2026-10-01T10:00:00+0300',
};

describe('HeadHunter parser', () => {
  it('reads refs from a search page and flags the 2000-row window', () => {
    const page = parseHhList(LIST);
    expect(page.refs).toEqual([{ externalId: '55' }]);
    expect(page.found).toBe(12000);
    expect(hhListIsTruncated(page.found)).toBe(true);
    expect(hhListIsTruncated(HH_MAX_RESULTS_PER_QUERY)).toBe(false);
  });

  it('rejects a forbidden or empty search body', () => {
    expect(() => parseHhList({ errors: [{ type: 'forbidden' }] })).toThrow(/forbidden/i);
    expect(() => parseHhList({ items: [{ id: '' }] })).toThrow(/id/i);
  });

  it('maps a vacancy card onto the raw shape and keeps the archive flag', () => {
    const vacancy = parseHhVacancy(DETAIL);
    expect(vacancy.externalId).toBe('55');
    expect(vacancy.archived).toBe(true);
    expect(vacancy.salaryMin).toBe(2000);
    expect(vacancy.salaryMax).toBeNull();
    expect(vacancy.salaryCurrency).toBe('BYN');
    expect(vacancy.seniorityRaw).toBe('Нет опыта');
    expect(vacancy.workFormatRaw).toBe('Удаленная работа');
    expect(vacancy.city).toBe('Минск');
  });

  it('asks only for Belarus and refuses to shard a one-day window', () => {
    const path = buildHhListPath({ page: 0, dateFrom: '2026-10-01', dateTo: '2026-10-02' });
    expect(path).toContain(`area=${HH_AREA_BELARUS}`);
    expect(path).toContain('per_page=100');
    expect(path).toContain('date_from=2026-10-01');
    const day = new Date('2026-10-01T00:00:00Z');
    expect(nextDateShards(day, new Date('2026-10-02T00:00:00Z'))).toEqual([]);
    const halves = nextDateShards(day, new Date('2026-10-09T00:00:00Z'));
    expect(halves).toHaveLength(2);
  });
});
