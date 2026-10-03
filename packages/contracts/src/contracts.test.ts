import { describe, expect, it } from 'vitest';
import {
  AuthorKind,
  DocumentFormat,
  DocumentKind,
  DuplicateDetection,
  EmploymentType,
  FeedbackRating,
  IngestionStatus,
  IntentType,
  Language,
  MatchFactor,
  MemoryKind,
  MessageRole,
  ParseStatus,
  ProfileSkillSource,
  QueryComplexity,
  RateUnit,
  RetrievalBranch,
  SeniorityLevel,
  SkillAliasSource,
  SkillEdgeType,
  SkillImportance,
  SkillLevel,
  SkillType,
  UserRole,
  VacancySource,
  VacancyStatus,
  WorkFormat,
  createApiErrorResponse,
} from './index';

describe('domain enums', () => {
  it('keeps the seniority bands from the data-source mapping', () => {
    expect(Object.values(SeniorityLevel)).toEqual([
      'NO_EXPERIENCE',
      'JUNIOR',
      'MIDDLE',
      'SENIOR',
      'LEAD',
    ]);
  });

  it('keeps work formats and employment types used by hard constraints', () => {
    expect(Object.values(WorkFormat)).toEqual(['ONSITE', 'REMOTE', 'HYBRID']);
    expect(Object.values(EmploymentType)).toEqual([
      'FULL_TIME',
      'PART_TIME',
      'PROJECT',
      'FREELANCE',
    ]);
  });

  it('keeps the six vacancy sources and the vacancy lifecycle', () => {
    expect(Object.values(VacancySource)).toEqual([
      'RABOTA_BY',
      'GSZ',
      'HABR_CAREER',
      'PRACA_BY',
      'LINKEDIN',
      'INDEED',
    ]);
    expect(Object.values(VacancyStatus)).toEqual(['ACTIVE', 'EXPIRED', 'CLOSED', 'DUPLICATE']);
  });

  it('keeps retrieval branches, complexity, and intent types', () => {
    expect(Object.values(RetrievalBranch)).toEqual(['LEXICAL', 'DENSE', 'GRAPH']);
    expect(Object.values(QueryComplexity)).toEqual([
      'SIMPLE',
      'MODERATE',
      'COMPLEX',
      'EXPLORATORY',
    ]);
    expect(Object.values(IntentType)).toEqual([
      'SEARCH',
      'REFINE',
      'COMPARE',
      'CAREER_ADVICE',
      'SMALL_TALK',
    ]);
  });

  it('keeps skill, memory, and message vocabularies', () => {
    expect(Object.values(SkillType)).toEqual(['HARD', 'SOFT', 'TOOL', 'LANGUAGE', 'DOMAIN']);
    expect(Object.values(SkillEdgeType)).toEqual([
      'ALTERNATIVE_OF',
      'BROADER',
      'NARROWER',
      'RELATED_TO',
      'PREREQUISITE_OF',
    ]);
    expect(Object.values(SkillImportance)).toEqual(['REQUIRED', 'PREFERRED', 'MENTIONED']);
    expect(Object.values(MemoryKind)).toEqual(['PREFERENCE', 'CONSTRAINT', 'FACT', 'GOAL']);
    expect(Object.values(MessageRole)).toEqual(['USER', 'ASSISTANT', 'SYSTEM']);
  });

  it('keeps the database enums that are not already covered above', () => {
    expect(Object.values(UserRole)).toEqual(['USER', 'ADMIN']);
    expect(Object.values(SkillLevel)).toEqual(['BASIC', 'CONFIDENT', 'EXPERT']);
    expect(Object.values(ProfileSkillSource)).toEqual([
      'SELF_REPORTED',
      'EXTRACTED_FROM_CHAT',
      'EXTRACTED_FROM_RESUME',
    ]);
    expect(Object.values(DocumentKind)).toEqual([
      'RESUME',
      'PREFERENCES',
      'LETTER',
      'SCRIPT',
      'NOTE',
    ]);
    expect(Object.values(DocumentFormat)).toEqual(['PDF', 'MD', 'TXT']);
    expect(Object.values(AuthorKind)).toEqual(['USER', 'ASSISTANT']);
    expect(Object.values(ParseStatus)).toEqual(['PENDING', 'SUCCESS', 'FAILED']);
    expect(Object.values(DuplicateDetection)).toEqual(['EXACT', 'FUZZY', 'EMBEDDING']);
    expect(Object.values(IngestionStatus)).toEqual(['RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED']);
    expect(Object.values(FeedbackRating)).toEqual(['RELEVANT', 'IRRELEVANT']);
    expect(Object.values(SkillAliasSource)).toEqual([
      'ESCO',
      'ESCO_TRANSLATED',
      'MANUAL',
      'LLM',
    ]);
  });

  it('keeps match factors, languages, and rate units', () => {
    expect(Object.values(MatchFactor)).toEqual([
      'SKILL_FIT',
      'SEMANTIC_FIT',
      'LEXICAL_FIT',
      'EXPERIENCE_FIT',
      'FORMAT_FIT',
      'SALARY_FIT',
    ]);
    expect(Object.values(Language)).toEqual(['ru', 'en']);
    expect(Object.values(RateUnit)).toEqual(['HOUR', 'DAY', 'PROJECT']);
  });
});

describe('createApiErrorResponse', () => {
  it('omits details when the caller does not pass them', () => {
    expect(createApiErrorResponse('NOT_FOUND', 'Route not found', 'req-1')).toEqual({
      errorCode: 'NOT_FOUND',
      message: 'Route not found',
      requestId: 'req-1',
    });
  });

  it('includes details when the caller passes them', () => {
    expect(
      createApiErrorResponse('NOT_READY', 'Dependencies are unavailable', 'req-2', {
        checks: { postgres: 'down' },
      }),
    ).toEqual({
      errorCode: 'NOT_READY',
      message: 'Dependencies are unavailable',
      requestId: 'req-2',
      details: { checks: { postgres: 'down' } },
    });
  });
});
