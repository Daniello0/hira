import { MessageRole } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { buildUnderstandMessages } from './build-understand-messages';

describe('buildUnderstandMessages', () => {
  it('puts the query last and carries history and memory', () => {
    const messages = buildUnderstandMessages({
      query: 'remote?',
      history: [
        { role: MessageRole.User, content: 'python' },
        { role: MessageRole.Assistant, content: 'which city?' },
      ],
      memory: [{ content: 'lives in Minsk' }],
    });
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('stands alone');
    expect(messages[0]?.content).toContain('null unless the user stated it');
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'remote?' });
    expect(messages).toContainEqual({ role: 'user', content: 'python' });
    expect(messages).toContainEqual({ role: 'assistant', content: 'which city?' });
    expect(messages.map((message) => message.content).join('\n')).toContain('lives in Minsk');
  });

  it('still starts with a system message when history and memory are empty', () => {
    const messages = buildUnderstandMessages({ query: 'java', history: [], memory: [] });
    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(messages[1]).toEqual({ role: 'user', content: 'java' });
  });
});
