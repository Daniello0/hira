import { QueryComplexity, RetrievalBranch, SeniorityLevel } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { readSearchRequest } from './read-search-request';

describe('readSearchRequest', () => {
  it('reads skills, grade, limit, user, and rerank knobs', () => {
    const parsed = readSearchRequest({
      intent: {
        rewrittenQuery: 'python',
        skills: [{ surface: 'Python', canonicalId: '4', required: true }],
        complexity: QueryComplexity.Exploratory,
        seniority: SeniorityLevel.Junior,
        hardConstraints: { salaryMin: 1000 },
      },
      userId: 'user-1',
      options: {
        rerank: false,
        personalize: true,
        branchWeights: { [RetrievalBranch.Graph]: 0.2 },
      },
    });
    expect(parsed?.limit).toBe(10);
    expect(parsed?.userId).toBe('user-1');
    expect(parsed?.intent.skills).toEqual([{ surface: 'Python', canonicalId: '4', required: true }]);
    expect(parsed?.intent.complexity).toBe(QueryComplexity.Exploratory);
    expect(parsed?.intent.seniority).toBe(SeniorityLevel.Junior);
    expect(parsed?.intent.hardConstraints.salaryMin).toBe(1000);
    expect(parsed?.options?.rerank).toBe(false);
    expect(parsed?.options?.personalize).toBe(true);
    expect(parsed?.options?.branchWeights?.[RetrievalBranch.Graph]).toBe(0.2);
  });

  it('rejects a foreign complexity, a bad skill, a non-numeric weight, and a non-boolean rerank', () => {
    const intent = { rewrittenQuery: 'python' };
    expect(readSearchRequest({ intent: { ...intent, complexity: 'NOPE' } })).toBeNull();
    expect(readSearchRequest({ intent: { ...intent, skills: [{ surface: 'Python' }] } })).toBeNull();
    expect(readSearchRequest({ intent, options: { branchWeights: { GRAPH: 'high' } } })).toBeNull();
    expect(readSearchRequest({ intent, options: { rerank: 'no' } })).toBeNull();
    expect(readSearchRequest({ intent, options: { personalize: 'yes' } })).toBeNull();
    expect(readSearchRequest({ intent, limit: 0 })).toBeNull();
    expect(readSearchRequest({ intent, limit: 51 })).toBeNull();
  });
});
