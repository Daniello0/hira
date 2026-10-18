import { MessageRole } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { WORKING_WINDOW_SIZE } from './chat.constants';
import { promptHistory } from './history-window';
import type { MessageRecord } from './chat.store';

describe('history window', () => {
  it('keeps the last ten user and assistant turns and drops the current query', () => {
    const messages = Array.from({ length: WORKING_WINDOW_SIZE + 1 }, (_, index) =>
      message(index, index % 2 === 0 ? MessageRole.User : MessageRole.Assistant),
    );
    const history = promptHistory(messages);
    expect(history).toHaveLength(WORKING_WINDOW_SIZE);
    expect(history[0]?.content).toBe('m1');
    expect(history.at(-1)?.content).toBe(`m${WORKING_WINDOW_SIZE}`);
    expect(history.some((turn) => turn.role === MessageRole.System)).toBe(false);
  });
});

function message(index: number, role: MessageRole): MessageRecord {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    chatId: '00000000-0000-4000-8000-000000000099',
    role,
    content: `m${index}`,
    intent: null,
    diagnostics: null,
    tokenUsage: null,
    createdAt: new Date(`2026-10-18T10:00:${String(index).padStart(2, '0')}.000Z`),
  };
}
