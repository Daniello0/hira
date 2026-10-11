import {
  EmploymentType,
  IntentType,
  Language,
  MessageRole,
  QueryComplexity,
  RetrievalBranch,
  SeniorityLevel,
  VacancySource,
  VacancyStatus,
  WorkFormat,
  type SearchIntent,
  type VacancyResult,
} from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { buildGenerateMessages } from './build-generate-messages';

const instruction =
  'Answer in the language of the latest user message. Use only the vacancies and explanations provided. Do not invent vacancies.';

describe('buildGenerateMessages', () => {
  it('grounds the prompt in the title, score, and explanation', () => {
    const messages = buildGenerateMessages({
      intent: intent(),
      history: [{ role: MessageRole.User, content: 'looking in Minsk' }],
      results: [result('Backend engineer', 'SECRET_DESCRIPTION', 'Docker')],
    });
    const blob = messages.map((message) => message.content).join('\n');
    expect(messages[0]).toEqual({ role: 'system', content: instruction });
    expect(blob).toContain('Backend engineer');
    expect(blob).toContain('Docker');
    expect(blob).toContain('87');
    expect(blob).toContain('looking in Minsk');
    expect(blob).toContain('remote python');
    expect(blob).not.toContain('SECRET_DESCRIPTION');
    expect(blob).not.toContain('https://example.test/secret-url');
    expect(blob).not.toContain('No vacancies were retrieved.');
  });

  it('keeps the first ten results and says when the list is empty', () => {
    const results = Array.from({ length: 11 }, (_item, index) =>
      result(index === 10 ? 'ELEVENTH_TITLE' : `Role ${index}`, 'desc', 'Skill'),
    );
    const limited = buildGenerateMessages({ intent: intent(), history: [], results })
      .map((message) => message.content)
      .join('\n');
    expect(limited).toContain('Role 0');
    expect(limited).toContain('Role 9');
    expect(limited).not.toContain('ELEVENTH_TITLE');

    const empty = buildGenerateMessages({ intent: intent(), history: [], results: [] })
      .map((message) => message.content)
      .join('\n');
    expect(empty).toContain('No vacancies were retrieved.');
  });
});

function intent(): SearchIntent {
  return {
    rewrittenQuery: 'remote python',
    role: 'Python developer',
    skills: [],
    seniority: SeniorityLevel.Junior,
    hardConstraints: {},
    softConstraints: {},
    complexity: QueryComplexity.Simple,
    intentType: IntentType.Search,
  };
}

function result(title: string, description: string, skill: string): VacancyResult {
  return {
    vacancy: {
      id: title,
      source: VacancySource.RabotaBy,
      language: Language.En,
      externalId: 'ext',
      url: 'https://example.test/secret-url',
      title,
      companyId: null,
      locationId: null,
      description,
      seniority: SeniorityLevel.Junior,
      employment: EmploymentType.FullTime,
      workFormat: WorkFormat.Remote,
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
      status: VacancyStatus.Active,
      publishedAt: '2026-01-01T00:00:00.000Z',
    },
    score: 87,
    explanation: {
      totalScore: 87,
      factors: {
        skillFit: { score: 1 },
        semanticFit: { score: 1 },
        lexicalFit: { score: 1 },
        experienceFit: { score: 1 },
        formatFit: { score: 1 },
        salaryFit: { score: 1 },
      },
      matchedSkills: [{ surface: skill, canonicalId: null, evidenceSpan: null, path: null }],
      relatedSkills: [],
      missingSkills: [],
      retrievedBy: [RetrievalBranch.Lexical],
    },
    retrievedBy: [RetrievalBranch.Lexical],
  };
}
