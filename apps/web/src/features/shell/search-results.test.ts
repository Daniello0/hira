import type { ChatSummary } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { appendHits } from './search-results';

const chat = (id: string) => ({ id }) as ChatSummary;

describe('chat search pages', () => {
  it('adds the next page and moves the cursor', () => {
    const next = appendHits({ chats: [chat('a')], cursor: 'one', moreFailed: true }, { items: [chat('b')], nextCursor: 'two' });
    expect(next.chats.map((item) => item.id)).toEqual(['a', 'b']);
    expect(next.cursor).toBe('two');
    expect(next.moreFailed).toBe(false);
  });

  it('shows a chat once when two loads return the same page', () => {
    const next = appendHits({ chats: [chat('a')], cursor: 'one', moreFailed: false }, { items: [chat('a'), chat('b')], nextCursor: null });
    expect(next.chats.map((item) => item.id)).toEqual(['a', 'b']);
    expect(next.cursor).toBeNull();
  });
});
