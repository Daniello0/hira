import { MessageRole, type ChatMessageView } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { afterFailedSend, answerInterrupted } from './send-decision';

describe('afterFailedSend', () => {
  it('reloads once the stream has opened', () => {
    expect(afterFailedSend({ streamOpened: true, draft: 'python', messages: [] })).toBe('reload');
  });

  it('keeps the draft when the turn was never stored', () => {
    expect(afterFailedSend({ streamOpened: false, draft: 'python', messages: [] })).toBe('keep-draft');
  });

  it('does not send again when that text is already the last user turn', () => {
    const messages = [message('python')];
    expect(afterFailedSend({ streamOpened: false, draft: 'python', messages })).toBe('reload');
    expect(answerInterrupted(messages)).toBe(true);
  });
});

function message(content: string): ChatMessageView {
  return { id: '1', role: MessageRole.User, content, createdAt: '2026-10-18T00:00:00.000Z' };
}
