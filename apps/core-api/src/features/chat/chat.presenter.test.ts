import { IntentType, MessageRole, QueryComplexity, RetrievalBranch, type SearchIntent } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import type { MessageRecord, ShownVacancyRecord } from './chat.store';
import { toMessageView } from './chat.presenter';

describe('toMessageView', () => {
  it('keeps intent on the user turn and cards on the assistant turn', () => {
    const intent = searchIntent();
    const user = toMessageView(message(MessageRole.User, intent), []);
    const assistant = toMessageView(message(MessageRole.Assistant, null), [shown()]);
    expect(user.intent).toEqual(intent);
    expect(user.results).toBeUndefined();
    expect(assistant.intent).toBeUndefined();
    expect(assistant.results).toHaveLength(1);
  });
});

function message(role: MessageRole, intent: SearchIntent | null): MessageRecord {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    chatId: '10000000-0000-4000-8000-000000000002',
    role,
    content: 'python jobs',
    intent,
    diagnostics: null,
    tokenUsage: null,
    createdAt: new Date('2026-10-18T12:00:00.000Z'),
  };
}

function searchIntent(): SearchIntent {
  return {
    rewrittenQuery: 'python jobs',
    role: null,
    skills: [],
    seniority: null,
    hardConstraints: {},
    softConstraints: {},
    complexity: QueryComplexity.Simple,
    intentType: IntentType.Search,
  };
}

function shown(): ShownVacancyRecord {
  return {
    messageId: '10000000-0000-4000-8000-000000000001',
    vacancyId: '10000000-0000-4000-8000-000000000003',
    rank: 1,
    score: 80,
    explanation: {
      totalScore: 80,
      factors: {
        skillFit: { score: 80 },
        semanticFit: { score: 80 },
        lexicalFit: { score: 80 },
        experienceFit: { score: 80 },
        formatFit: { score: 80 },
        salaryFit: { score: 80 },
      },
      matchedSkills: [],
      relatedSkills: [],
      missingSkills: [],
      retrievedBy: [RetrievalBranch.Lexical],
    },
    retrievedBy: [RetrievalBranch.Lexical],
    vacancy: {
      id: '10000000-0000-4000-8000-000000000003',
      source: 'RABOTA_BY' as never,
      language: 'ru' as never,
      externalId: 'ext',
      url: 'https://example.test',
      title: 'Python',
      companyId: null,
      companyName: 'Hira Labs',
      locationId: null,
      locationLabel: 'Minsk',
      description: '',
      seniority: null,
      employment: null,
      workFormat: null,
      schedule: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryMinByn: null,
      salaryMaxByn: null,
      isGross: null,
      rateAmount: null,
      rateUnit: null,
      projectDurationDays: null,
      isForeignRemote: false,
      status: 'ACTIVE' as never,
      publishedAt: '',
    },
  };
}
