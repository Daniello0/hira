import { describe, expect, it } from 'vitest';
import { spokenContent } from './call-cut';

describe('spokenContent', () => {
  it('leaves a reply spoken to the end as it is', () => {
    expect(spokenContent('Две вакансии.', null)).toBe('Две вакансии.');
    expect(spokenContent('Две вакансии.', undefined)).toBe('Две вакансии.');
  });

  it('keeps both what was heard and what was prepared', () => {
    const text = spokenContent('Первая вакансия. Вторая вакансия.', 'Первая вакансия.');
    expect(text).toContain('heard only this: "Первая вакансия."');
    expect(text).toContain('Вторая вакансия.');
  });

  it('says so when nothing was heard', () => {
    expect(spokenContent('Первая вакансия.', '')).toContain('heard nothing');
  });

  it('leaves an empty reply empty, so history still drops it', () => {
    expect(spokenContent('', 'x')).toBe('');
  });
});
