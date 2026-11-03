import { describe, expect, it } from 'vitest';
import { splitAttachments, withAttachmentHeads, withAttachments } from './message-attachments';

describe('message attachments', () => {
  it('stores files after the words and reads them back', () => {
    const stored = withAttachments('Что скажешь?', [{ name: 'cv.pdf', text: 'Иван Петров\nReact' }, { name: 'data.csv', text: 'a,b' }]);
    expect(stored).toBe('Что скажешь?\n\n<<<file: cv.pdf>>>\nИван Петров\nReact\n<<<end of file>>>\n\n<<<file: data.csv>>>\na,b\n<<<end of file>>>');
    expect(splitAttachments(stored)).toEqual({ text: 'Что скажешь?', attachments: [{ name: 'cv.pdf', text: 'Иван Петров\nReact' }, { name: 'data.csv', text: 'a,b' }] });
  });

  it('leaves a message without files, or with a broken marker, as it is', () => {
    expect(splitAttachments('Привет')).toEqual({ text: 'Привет', attachments: [] });
    expect(splitAttachments('x <<<file: a>>> no end')).toEqual({ text: 'x <<<file: a>>> no end', attachments: [] });
    expect(withAttachments('Привет')).toBe('Привет');
  });

  it('cuts each file to its start for a quick read of the intent', () => {
    const stored = withAttachments('Что тут?', [{ name: 'a.txt', text: 'abcdef' }]);
    expect(withAttachmentHeads(stored, 3)).toBe('Что тут?\n\n<<<file: a.txt>>>\nabc…\n<<<end of file>>>');
    expect(withAttachmentHeads('Привет', 3)).toBe('Привет');
  });

  it('keeps a file sent without words', () => {
    expect(splitAttachments(withAttachments('', [{ name: 'a.txt', text: 'hi' }]))).toEqual({ text: '', attachments: [{ name: 'a.txt', text: 'hi' }] });
  });
});
