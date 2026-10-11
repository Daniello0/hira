import { IntentType, QueryComplexity, SeniorityLevel, WorkFormat } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { mapSearchIntent } from './map-search-intent';
import { parseModelIntent } from './search-intent.schema';
import { validModelIntent } from './understand.fixture';

describe('mapSearchIntent', () => {
  it('folds soft constraints and leaves canonicalId empty', () => {
    const mapped = mapSearchIntent(parseModelIntent(validModelIntent()));
    expect(mapped).toEqual({
      rewrittenQuery: 'Junior Python developer, remote, Minsk',
      role: 'Python developer',
      skills: [{ surface: 'Python', required: true, canonicalId: null }],
      seniority: SeniorityLevel.Junior,
      hardConstraints: { workFormat: [WorkFormat.Remote], location: ['Minsk'] },
      softConstraints: { medicine: 0.4 },
      complexity: QueryComplexity.Moderate,
      intentType: IntentType.Search,
    });
  });

  it('keeps a zero salary floor and drops an empty work-format list', () => {
    const raw = validModelIntent();
    raw.hardConstraints = {
      workFormat: [],
      employment: null,
      location: null,
      salaryMin: 0,
    };
    raw.softConstraints = [];
    raw.role = null;
    raw.skills = [];
    const mapped = mapSearchIntent(parseModelIntent(raw));
    expect(mapped.hardConstraints).toEqual({ salaryMin: 0 });
    expect(mapped.role).toBeNull();
    expect(mapped.softConstraints).toEqual({});
  });

  it('rejects a duplicated soft-constraint key', () => {
    const raw = validModelIntent();
    raw.softConstraints = [
      { key: 'medicine', weight: 0.2 },
      { key: 'medicine', weight: 0.8 },
    ];
    expect(() => mapSearchIntent(parseModelIntent(raw))).toThrow(/duplicate soft constraint: medicine/);
  });
});
