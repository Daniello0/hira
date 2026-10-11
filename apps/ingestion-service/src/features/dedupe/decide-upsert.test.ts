import { DuplicateDetection, VacancySource, VacancyStatus } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { decideUpsert } from './decide-upsert';
import { crossSourceDecision } from './cross-source';
import { simhash } from './simhash';

describe('decideUpsert', () => {
  it('inserts a new key, skips an unchanged hash, and updates a changed one', () => {
    expect(decideUpsert(null, 'a'.repeat(64))).toBe('insert');
    expect(decideUpsert('a'.repeat(64), 'a'.repeat(64))).toBe('skip');
    expect(decideUpsert('a'.repeat(64), 'b'.repeat(64))).toBe('update');
  });
});

describe('crossSourceDecision', () => {
  const description = simhash('пишем api на typescript и postgres');

  it('marks a later copy as a fuzzy duplicate and keeps the earlier row canonical', () => {
    const decision = crossSourceDecision({
      incoming: {
        source: VacancySource.HabrCareer,
        companyName: 'рога и копыта',
        title: 'backend',
        city: 'Минск',
        simhash: description,
      },
      existing: {
        id: 'canon',
        source: VacancySource.RabotaBy,
        companyName: 'рога и копыта',
        title: 'Backend',
        city: 'Минск',
        simhash: description,
        status: VacancyStatus.Active,
      },
    });
    expect(decision).toEqual({
      duplicate: true,
      canonicalId: 'canon',
      detectedBy: DuplicateDetection.Fuzzy,
    });
  });

  it('does not confirm a duplicate when the title, city, or source key differs', () => {
    const base = {
      source: VacancySource.HabrCareer,
      companyName: 'рога и копыта',
      title: 'backend',
      city: 'Минск',
      simhash: description,
    };
    const existing = {
      id: 'canon',
      source: VacancySource.RabotaBy,
      companyName: 'рога и копыта',
      title: 'Backend',
      city: 'Минск',
      simhash: description,
      status: VacancyStatus.Active,
    };
    expect(
      crossSourceDecision({ incoming: { ...base, title: 'дизайнер' }, existing }).duplicate,
    ).toBe(false);
    expect(crossSourceDecision({ incoming: { ...base, city: 'Брест' }, existing }).duplicate).toBe(
      false,
    );
    expect(
      crossSourceDecision({
        incoming: base,
        existing: { ...existing, source: VacancySource.HabrCareer },
      }).duplicate,
    ).toBe(false);
    expect(
      crossSourceDecision({
        incoming: base,
        existing: { ...existing, status: VacancyStatus.Closed },
      }).duplicate,
    ).toBe(false);
  });
});
