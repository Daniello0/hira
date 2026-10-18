import { MessageRole, type ChatMessageView } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { StreamPhase } from './stream-phase';
import { MAX_MESSAGE_LENGTH } from './chat.constants';
import {
  afterFailedSend,
  answerInterrupted,
  prependMessages,
  rejectDraft,
  shouldApplyHistory,
} from './send-decision';

describe('afterFailedSend', () => {
  it('reloads once the stream has opened', () => {
    expect(afterFailedSend({ streamOpened: true, draft: 'python', messages: [] })).toBe('reload');
  });

  it('keeps the draft when the turn was never stored', () => {
    expect(afterFailedSend({ streamOpened: false, draft: 'python', messages: [] })).toBe(
      'keep-draft',
    );
  });

  it('does not send again when that text is already the last user turn', () => {
    const messages = [message('python')];
    expect(afterFailedSend({ streamOpened: false, draft: 'python', messages })).toBe('reload');
    expect(answerInterrupted(messages)).toBe(true);
  });

  it('does not replace the transcript while a turn is open', () => {
    expect(shouldApplyHistory(StreamPhase.Idle)).toBe(true);
    expect(shouldApplyHistory(StreamPhase.Searching)).toBe(false);
    expect(shouldApplyHistory(StreamPhase.Writing)).toBe(false);
  });

  it('drops a second copy of the same older page', () => {
    const older = [message('older', 'a')];
    const current = [message('newer', 'b')];
    expect(prependMessages(prependMessages(current, older), older).map((item) => item.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('refuses a message longer than the server limit and says why', () => {
    expect(rejectDraft('python', StreamPhase.Idle)).toBe('ok');
    expect(rejectDraft('   ', StreamPhase.Idle)).toBe('empty');
    expect(rejectDraft('python', StreamPhase.Searching)).toBe('busy');
    expect(rejectDraft('x'.repeat(MAX_MESSAGE_LENGTH + 1), StreamPhase.Idle)).toBe('too-long');
  });
});

function message(content: string, id = '1'): ChatMessageView {
  return { id, role: MessageRole.User, content, createdAt: '2026-10-18T00:00:00.000Z' };
}
