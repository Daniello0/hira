import { describe, expect, it } from 'vitest';
import { MAX_CHAT_TITLE_LENGTH, titleFromFirstMessage } from './chat.constants';

describe('titleFromFirstMessage', () => {
  it('keeps an emoji that sits on the length boundary', () => {
    const title = titleFromFirstMessage(`${'я'.repeat(MAX_CHAT_TITLE_LENGTH - 1)}😀extra`);
    expect(title.endsWith('😀')).toBe(true);
    expect(title.includes('extra')).toBe(false);
    expect([...title]).toHaveLength(MAX_CHAT_TITLE_LENGTH);
  });
  it('titles a chat by its words or its file names, never by the file markers', () => {
    expect(titleFromFirstMessage('Что тут?\n\n<<<file: cv.pdf>>>\nИван\n<<<end of file>>>')).toBe('Что тут?');
    expect(titleFromFirstMessage('<<<file: cv.pdf>>>\nИван\n<<<end of file>>>')).toBe('cv.pdf');
  });
});
