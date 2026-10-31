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
  VoiceLanguage,
  WorkFormat,
  type GenerateRequest,
  type SearchIntent,
  type TurnFacts,
  type VacancyResult,
} from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { GENERATE_SYSTEM_PROMPT } from '../llm/llm.constants';
import { buildGenerateMessages } from './build-generate-messages';

const instruction = GENERATE_SYSTEM_PROMPT;

describe('buildGenerateMessages', () => {
  it('tells the model the company, city, format, pay, and site of each vacancy', () => {
    const base = result('Backend engineer', 'x', 'Docker');
    const blob = textOf({
      intent: intent(),
      history: [],
      results: [{ ...base, vacancy: { ...base.vacancy, companyName: 'Acme', locationLabel: 'Гомель', workFormat: WorkFormat.Remote, salaryMin: 1000, salaryMax: 2000, salaryCurrency: 'BYN', source: VacancySource.HabrCareer } }],
    });
    expect(blob).toContain('Acme');
    expect(blob).toContain('Гомель');
    expect(blob).toContain('REMOTE');
    expect(blob).toContain('1000-2000 BYN');
    expect(blob).toContain('career.habr.com');
  });

  it('says plainly when a vacancy has no city', () => {
    const base = result('Backend engineer', 'x', 'Docker');
    const blob = textOf({ intent: intent(), history: [], results: [{ ...base, vacancy: { ...base.vacancy, locationLabel: null } }] });
    expect(blob).toContain('city not stated');
  });

  it('gives every kind of reply the catalog counts', () => {
    const facts = emptyFacts({
      catalog: {
        total: 1200,
        byRegion: [{ region: 'Минск', count: 700 }, { region: 'Гомельская область', count: 40 }],
        topCities: [{ city: 'Минск', count: 700 }],
        noLocation: 12,
        remote: 90,
        foreignRemote: 5,
        bySource: [{ source: VacancySource.RabotaBy, count: 300 }],
      },
    });
    for (const intentType of [IntentType.Search, IntentType.SmallTalk, IntentType.CareerAdvice]) {
      const blob = textOf({ intent: { ...intent(), intentType }, history: [], results: [], facts });
      expect(blob).toContain('1200');
      expect(blob).toContain('Гомельская область 40');
      expect(blob).toContain('remote 90');
      expect(blob).toContain('rabota.by 300');
    }
  });

  it('numbers the vacancies shown earlier so "the third one" can be answered', () => {
    const facts = emptyFacts({
      shownHere: [
        { title: 'First', company: 'A', city: 'Минск', source: 'rabota.by', workFormat: null },
        { title: 'Third', company: 'C', city: null, source: 'career.habr.com', workFormat: null },
      ],
    });
    const blob = textOf({ intent: { ...intent(), intentType: IntentType.SmallTalk }, history: [], results: [], facts });
    expect(blob).toContain('1. First');
    expect(blob).toContain('2. Third');
    expect(blob).toContain('career.habr.com');
  });

  it('carries favorites, profile, memory, and earlier chats', () => {
    const facts = emptyFacts({
      profile: { name: 'Ada', headline: 'QA lead', about: null, seniority: 'SENIOR', desiredRoles: ['QA'], workFormats: ['REMOTE'], salaryMin: 3000, currency: 'BYN', education: null, skills: ['Python'] },
      memory: [{ content: 'Prefers Minsk' }],
      favorites: [{ title: 'Saved job', company: 'Acme', city: 'Брест', source: 'praca.by', workFormat: null }],
      activity: [{ kind: 'chat', title: 'Python search', summary: 'Looked for python', queries: ['python minsk'], vacancies: [{ title: 'Old job', company: 'B', city: null, source: 'gsz.gov.by', workFormat: null }] }],
    });
    const blob = textOf({ intent: { ...intent(), intentType: IntentType.SmallTalk }, history: [], results: [], facts });
    for (const piece of ['Ada', 'QA lead', 'Python', 'Prefers Minsk', 'Saved job', 'Брест', 'Python search', 'Looked for python', 'python minsk', 'Old job', 'gsz.gov.by']) {
      expect(blob).toContain(piece);
    }
  });

  it('says how many vacancies are saved when only the latest are listed', () => {
    const saved = { title: 'Saved job', company: 'Acme', city: null, source: null, workFormat: null };
    const request = { intent: { ...intent(), intentType: IntentType.SmallTalk }, history: [], results: [] };
    expect(textOf({ ...request, facts: emptyFacts({ favorites: [saved], favoritesTotal: 30 }) })).toContain('the latest 1 of 30');
    expect(textOf({ ...request, facts: emptyFacts({ favorites: [], favoritesTotal: 30 }) })).toContain('Saved vacancies: 30');
    expect(textOf({ ...request, facts: emptyFacts({ favorites: [saved] }) })).not.toContain(' of 1');
  });

  it('asks for a short spoken reply on a call, in the chosen language', () => {
    const spoken = buildGenerateMessages({ intent: intent(), history: [], results: [], voice: { language: VoiceLanguage.German } });
    expect(spoken[0]?.content).toContain('voice call');
    expect(spoken[0]?.content).toContain('Reply in German');
    const free = buildGenerateMessages({ intent: intent(), history: [], results: [], voice: { language: null } });
    expect(free[0]?.content).toContain('voice call');
    expect(free[0]?.content).not.toContain('Reply in');
  });

  it('leaves a chat reply and a file draft as they are', () => {
    expect(buildGenerateMessages({ intent: intent(), history: [], results: [] })[0]?.content).toBe(GENERATE_SYSTEM_PROMPT);
    const draft = buildGenerateMessages({ intent: { ...intent(), intentType: IntentType.DraftDocument }, history: [], results: [], voice: { language: null } });
    expect(draft[0]?.content).not.toContain('voice call');
  });

  it('keeps the catalog out of a draft but leaves the profile in', () => {
    const facts = emptyFacts({
      catalog: { total: 1200, byRegion: [], topCities: [], noLocation: 0, remote: 0, foreignRemote: 0, bySource: [] },
      profile: { name: 'Ada', headline: null, about: null, seniority: null, desiredRoles: [], workFormats: [], salaryMin: null, currency: null, education: null, skills: [] },
    });
    const blob = textOf({ intent: { ...intent(), intentType: IntentType.DraftDocument }, history: [], results: [], facts });
    expect(blob).not.toContain('1200');
    expect(blob).toContain('Ada');
  });

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

  it('gives career advice the original message and no vacancy list', () => {
    const messages = buildGenerateMessages({
      intent: { ...intent(), intentType: IntentType.CareerAdvice },
      history: [{ role: MessageRole.User, content: 'как перейти в data science?' }],
      results: [result('Backend engineer', 'desc', 'Docker')],
    });
    expect(messages[0]?.content).not.toContain('Use only the vacancies');
    expect(messages[1]?.content).toContain('Latest user message: как перейти в data science?');
    expect(messages[1]?.content).not.toContain('Backend engineer');
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
      companyName: '',
      locationId: null,
      locationLabel: null,
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

function textOf(request: GenerateRequest): string {
  return buildGenerateMessages(request).map((message) => message.content).join('\n');
}

function emptyFacts(partial: Partial<TurnFacts>): TurnFacts {
  return { catalog: null, profile: null, memory: [], favorites: [], favoritesTotal: partial.favorites?.length ?? 0, activity: [], shownHere: [], ...partial };
}
