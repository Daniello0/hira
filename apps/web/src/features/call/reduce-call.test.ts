import { IntentType, MessageRole } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { SessionStatus } from '../auth/session-status';
import { CallPhase } from './call-phase';
import {
  canStartCall,
  emptyCall,
  finishCall,
  onFinalTranscript,
  reduceCallEvent,
  resumeCallAfterTurn,
  showTypeInstead,
} from './reduce-call';

describe('call phase', () => {
  it('does not start a call for a demo session', () => {
    expect(canStartCall(SessionStatus.Anonymous)).toBe(false);
    expect(canStartCall(SessionStatus.Account)).toBe(true);
  });

  it('moves a final phrase to thinking and skips cards when results are empty', () => {
    let state = onFinalTranscript(emptyCall(), 'u1', 'hello');
    expect(state.phase).toBe(CallPhase.Thinking);
    state = reduceCallEvent(state, { event: 'results', data: { results: [] } });
    expect(state.cards).toHaveLength(0);
    state = reduceCallEvent(state, { event: 'done', data: {} });
    expect(state.phase).toBe(CallPhase.Speaking);
  });

  it('returns to idle when the call ends', () => {
    const listening = onFinalTranscript(emptyCall(), 'u1', 'jobs');
    expect(finishCall().phase).toBe(CallPhase.Idle);
    expect(listening.captions[0]?.role).toBe(MessageRole.User);
  });

  it('keeps searching off until the intent is a search', () => {
    const thinking = onFinalTranscript(emptyCall(), 'u1', 'hello');
    expect(thinking.searching).toBe(false);
    const talk = reduceCallEvent(thinking, {
      event: 'intent',
      data: { intentType: IntentType.SmallTalk },
    });
    expect(talk.searching).toBe(false);
  });

  it('gives each spoken answer its own caption', () => {
    let state = reduceCallEvent(onFinalTranscript(emptyCall(), 'u1', 'hello'), {
      event: 'token',
      data: { delta: 'Hi' },
    });
    state = reduceCallEvent(onFinalTranscript(state, 'u2', 'python'), {
      event: 'token',
      data: { delta: 'Found' },
    });
    const assistants = state.captions.filter((caption) => caption.role === MessageRole.Assistant);
    expect(assistants).toHaveLength(2);
    expect(new Set(assistants.map((caption) => caption.id)).size).toBe(2);
  });

  it('returns to listening when the turn never starts speaking', () => {
    const thinking = onFinalTranscript(emptyCall(), 'u1', 'python');
    expect(resumeCallAfterTurn(thinking, false).phase).toBe(CallPhase.Listening);
    const speaking = reduceCallEvent(thinking, { event: 'done', data: {} });
    expect(resumeCallAfterTurn(speaking, true).phase).toBe(CallPhase.Speaking);
  });

  it('shows type-instead only when recognition is missing', () => {
    expect(showTypeInstead(false)).toBe(true);
    expect(showTypeInstead(true)).toBe(false);
    const searching = reduceCallEvent(onFinalTranscript(emptyCall(), 'u1', 'python'), {
      event: 'intent',
      data: { intentType: IntentType.Search },
    });
    expect(searching.searching).toBe(true);
  });
});
