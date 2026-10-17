import {
  Language,
  SeniorityLevel,
  VacancySource,
  VacancyStatus,
  WorkFormat,
} from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { contentHash } from './content-hash';
import { normalizeCompanyName } from './company-name';
import { mapSeniority, mapWorkFormat } from './map-enums';
import { normalizeVacancy } from './normalize-vacancy';
import type { RawVacancy } from '../connectors/raw-vacancy';

const raw = (patch: Partial<RawVacancy> = {}): RawVacancy => ({
  externalId: '100',
  url: 'https://rabota.by/vacancy/100',
  title: 'Backend',
  companyName: 'ООО "Рога и Копыта"',
  unp: null,
  region: 'Минск',
  city: 'Минск',
  descriptionHtml: '<p>Пишем <b>API</b></p><script>alert(1)</script>',
  seniorityRaw: 'От 1 года до 3 лет',
  employmentRaw: 'Полная занятость',
  workFormatRaw: 'Удалённо',
  schedule: null,
  salaryMin: 100,
  salaryMax: 200,
  salaryCurrency: 'USD',
  isGross: true,
  publishedAt: '2026-10-01T10:00:00+03:00',
  archived: false,
  ...patch,
});

describe('normalizeVacancy', () => {
  it('maps a Belarus vacancy into the canonical columns', () => {
    const vacancy = normalizeVacancy(raw(), { USD: 3 });
    expect(vacancy.source).toBe(VacancySource.RabotaBy);
    expect(vacancy.language).toBe(Language.Ru);
    expect(vacancy.isForeignRemote).toBe(false);
    expect(vacancy.status).toBe(VacancyStatus.Active);
    expect(vacancy.seniority).toBe(SeniorityLevel.Junior);
    expect(vacancy.workFormat).toBe(WorkFormat.Remote);
    expect(vacancy.description).toBe('Пишем API');
    expect(vacancy.descriptionRaw).toContain('<script>');
    expect(vacancy.companyName).toBe('рога и копыта');
    expect(vacancy.salaryMinByn).toBe('300.00');
    expect(vacancy.salaryMaxByn).toBe('600.00');
    expect(vacancy.skillsText).toBe('');
  });

  it('leaves an unknown band empty and keeps foreign pay without a rate', () => {
    const vacancy = normalizeVacancy(
      raw({ seniorityRaw: 'стажёр космонавта', salaryCurrency: 'EUR' }),
      { USD: 3 },
    );
    expect(vacancy.seniority).toBeNull();
    expect(vacancy.salaryMin).toBe('100.00');
    expect(vacancy.salaryMinByn).toBeNull();
  });

  it('strips the city prefix so it can match the locations dictionary', () => {
    expect(normalizeVacancy(raw({ city: 'г. Минск' }), {}).city).toBe('Минск');
    expect(normalizeVacancy(raw({ city: '   ' }), {}).city).toBeNull();
  });

  it('closes an archived posting and rejects an empty title', () => {
    expect(normalizeVacancy(raw({ archived: true }), {}).status).toBe(VacancyStatus.Closed);
    expect(() => normalizeVacancy(raw({ title: '   ' }), {})).toThrow(/title/i);
  });

  it('hashes title, description, skills, and conditions, ignoring markup', () => {
    const left = contentHash({
      title: 'Backend',
      description: 'Пишем API',
      skillsText: '',
      conditions: 'remote',
    });
    const right = contentHash({
      title: 'Backend',
      description: 'Пишем API',
      skillsText: '',
      conditions: 'remote',
    });
    expect(left).toHaveLength(64);
    expect(left).toBe(right);
    expect(normalizeCompanyName('  ОАО  «Ромашка» ')).toBe('ромашка');
    expect(mapSeniority('нет опыта')).toBe(SeniorityLevel.NoExperience);
    expect(mapWorkFormat('на месте работодателя')).toBe(WorkFormat.Onsite);
  });
});
