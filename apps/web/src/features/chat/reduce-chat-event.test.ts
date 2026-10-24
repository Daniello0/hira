import { IntentType, MessageRole, QueryComplexity, VacancyStatus, type VacancyResult } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_ERROR_CODE, SEARCHING_LABEL, SEARCH_UPSTREAM_UNAVAILABLE, SIGN_UP_BANNER } from './chat.constants';
import { canSubmit, emptyTurn, reduceChatEvent } from './reduce-chat-event';
import { StreamPhase } from './stream-phase';

describe('reduceChatEvent', () => {
  it('searches until cards arrive, then writes tokens above them', () => {
    let turn = reduceChatEvent(emptyTurn(), { event: 'user-message', data: user('1', 'python') });
    expect(turn.phase).toBe(StreamPhase.Searching);
    expect(SEARCHING_LABEL).toBe('Searching…');
    turn = reduceChatEvent(turn, { event: 'intent', data: intent(IntentType.Search) });
    expect(turn.phase).toBe(StreamPhase.Searching);
    turn = reduceChatEvent(turn, { event: 'results', data: { results: [card()] } });
    expect(turn.phase).toBe(StreamPhase.Writing);
    expect(turn.pendingResults).toHaveLength(1);
    turn = reduceChatEvent(turn, { event: 'token', data: { delta: 'Hi' } });
    expect(turn.pendingText).toBe('Hi');
    expect(turn.pendingResults).toHaveLength(1);
    turn = reduceChatEvent(turn, { event: 'done', data: {} });
    expect(turn.phase).toBe(StreamPhase.Idle);
    expect(turn.pendingResults).toHaveLength(0);
  });

  it('drops the spinner for small talk before tokens', () => {
    let turn = reduceChatEvent(emptyTurn(), { event: 'user-message', data: user('1', 'hello') });
    turn = reduceChatEvent(turn, { event: 'intent', data: intent(IntentType.SmallTalk) });
    expect(turn.phase).toBe(StreamPhase.Writing);
  });

  it('shows the sign-up banner on quota and does not wait for done', () => {
    let turn = reduceChatEvent(emptyTurn(), { event: 'user-message', data: user('1', 'python') });
    turn = reduceChatEvent(turn, { event: 'error', data: { errorCode: RATE_LIMIT_ERROR_CODE, message: 'Search quota exceeded' } });
    expect(turn.phase).toBe(StreamPhase.Idle);
    expect(turn.banner).toBe(SIGN_UP_BANNER);
    expect(turn.pendingResults).toHaveLength(0);
  });

  it('does not draw cards when search is unavailable', () => {
    let turn = reduceChatEvent(emptyTurn(), { event: 'results', data: { results: [card()] } });
    turn = reduceChatEvent(turn, { event: 'error', data: { errorCode: SEARCH_UPSTREAM_UNAVAILABLE, message: 'Search is temporarily unavailable' } });
    expect(turn.pendingResults).toHaveLength(0);
    expect(turn.notice).toBe('Search is temporarily unavailable');
  });

  it('does not glue a draft from a failed turn onto the next answer', () => {
    let turn = reduceChatEvent(emptyTurn(), { event: 'document-draft', data: draft() });
    turn = reduceChatEvent(turn, { event: 'error', data: { errorCode: 'UPSTREAM', message: 'Hira stopped' } });
    turn = reduceChatEvent(turn, { event: 'user-message', data: user('2', 'hello') });
    turn = reduceChatEvent(turn, { event: 'assistant-message', data: assistant('a', 'Hello') });
    expect(turn.pendingDraft).toBeNull();
    expect(turn.drafts).toEqual({});
  });

  it('keeps a draft on the assistant message of the same turn', () => {
    let turn = reduceChatEvent(emptyTurn(), { event: 'document-draft', data: draft() });
    turn = reduceChatEvent(turn, { event: 'assistant-message', data: assistant('a', 'Here is the file') });
    expect(turn.pendingDraft).toBeNull();
    expect(turn.drafts.a?.title).toBe('Cover letter');
  });

  it('blocks a second submit while the turn is open', () => {
    const searching = reduceChatEvent(emptyTurn(), { event: 'user-message', data: user('1', 'python') });
    expect(canSubmit(searching.phase)).toBe(false);
    expect(canSubmit(StreamPhase.Idle)).toBe(true);
  });
});

function user(id: string, content: string) {
  return { id, role: MessageRole.User, content, createdAt: '2026-10-18T00:00:00.000Z' };
}

function assistant(id: string, content: string) {
  return { id, role: MessageRole.Assistant, content, createdAt: '2026-10-18T00:00:01.000Z' };
}

function draft() {
  return { title: 'Cover letter', format: 'md', content: 'Hello', targetDocumentId: 'doc-1', targetTitle: 'Cover letter' };
}

function intent(intentType: IntentType) {
  return { rewrittenQuery: 'python', role: null, skills: [], seniority: null, hardConstraints: {}, softConstraints: {}, complexity: QueryComplexity.Simple, intentType };
}

function card(): VacancyResult {
  const factor = { score: 80 };
  return {
    vacancy: {
      id: 'v',
      source: 'RABOTA_BY' as never,
      language: 'en' as never,
      externalId: 'e',
      url: 'https://example.test',
      title: 'Python',
      companyId: null,
      companyName: 'Labs',
      locationId: null,
      locationLabel: 'Minsk',
      description: '',
      seniority: null,
      employment: null,
      workFormat: null,
      schedule: null,
      salaryMin: 1000,
      salaryMax: 2000,
      salaryCurrency: 'BYN',
      salaryMinByn: null,
      salaryMaxByn: null,
      isGross: null,
      rateAmount: null,
      rateUnit: null,
      projectDurationDays: null,
      isForeignRemote: false,
      status: VacancyStatus.Active,
      publishedAt: '',
    },
    score: 80,
    explanation: {
      totalScore: 80,
      factors: { skillFit: factor, semanticFit: factor, lexicalFit: factor, experienceFit: factor, formatFit: factor, salaryFit: factor },
      matchedSkills: [],
      relatedSkills: [],
      missingSkills: [],
      retrievedBy: [],
    },
    retrievedBy: [],
  };
}
