import { IntentType, QueryComplexity } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { heuristicIntent } from './heuristic-intent';

describe('heuristic intent', () => {
  it('keeps the raw query and invents no constraints', () => {
    expect(heuristicIntent('  remote python  ')).toEqual({
      rewrittenQuery: 'remote python',
      role: null,
      skills: [],
      seniority: null,
      hardConstraints: {},
      softConstraints: {},
      complexity: QueryComplexity.Simple,
      intentType: IntentType.Search,
    });
  });
});
