import { IntentType, MessageRole } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { SessionStatus } from '../auth/session-status';
import { CallPhase } from './call-phase';
import { canStartCall, emptyCall, finishCall, onFinalTranscript, reduceCallEvent, showTypeInstead } from './reduce-call';

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
