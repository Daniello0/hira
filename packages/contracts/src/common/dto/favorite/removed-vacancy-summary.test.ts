import { describe, expect, it } from 'vitest';
import { REMOVED_VACANCY_TITLE, isRemovedVacancySummary, removedVacancySummary } from './removed-vacancy-summary';

describe('removedVacancySummary', () => {
  it('marks placeholder cards consistently', () => {
    const summary = removedVacancySummary('vac-1');
    expect(summary.title).toBe(REMOVED_VACANCY_TITLE);
    expect(isRemovedVacancySummary(summary)).toBe(true);
    expect(isRemovedVacancySummary({ ...summary, title: 'Engineer' })).toBe(false);
  });
});
