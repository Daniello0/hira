import { describe, expect, it, vi } from 'vitest';
import { LibraryInputError } from './library.service';
import { htmlText, looksLikeResume, readAttachment } from './read-attachment';

const pdf = { read: vi.fn(async () => 'PDF text') };

describe('readAttachment', () => {
  it('reads each kind of file with its reader', async () => {
    const image = vi.fn(async () => 'Text on the picture');
    expect((await readAttachment({ buffer: Buffer.from('%PDF'), originalname: 'cv.pdf' }, { pdf, image })).text).toBe('PDF text');
    expect((await readAttachment({ buffer: Buffer.from('png'), originalname: 'shot.PNG' }, { pdf, image })).text).toBe('Text on the picture');
    expect(image).toHaveBeenCalledWith(Buffer.from('png'), 'image/png');
    expect((await readAttachment({ buffer: Buffer.from('a,b\n1,2'), originalname: 'data.csv' }, { pdf, image })).text).toBe('a,b\n1,2');
    expect((await readAttachment({ buffer: Buffer.from('<p>Hi&amp;bye</p><script>x()</script>'), originalname: 'page.html' }, { pdf, image })).text).toBe('Hi&bye');
  });

  it('refuses a type it cannot read and an empty file', async () => {
    const image = vi.fn();
    await expect(readAttachment({ buffer: Buffer.from('x'), originalname: 'tool.exe' }, { pdf, image })).rejects.toBeInstanceOf(LibraryInputError);
    await expect(readAttachment({ buffer: Buffer.from('  '), originalname: 'empty.txt' }, { pdf, image })).rejects.toBeInstanceOf(LibraryInputError);
  });

  it('cuts a long file and says so', async () => {
    const read = await readAttachment({ buffer: Buffer.from('a'.repeat(25_000)), originalname: 'long.txt' }, { pdf, image: vi.fn() });
    expect(read.truncated).toBe(true);
    expect(read.text).toHaveLength(20_000);
  });
});

describe('looksLikeResume', () => {
  it('knows a resume by its headings', () => {
    expect(looksLikeResume('Иван Петров\nОпыт работы\n2020–2024 Frontend\nОбразование\nБГУИР')).toBe(true);
    expect(looksLikeResume('Jane Doe\njane@mail.com\nSkills: React, TypeScript')).toBe(true);
    expect(looksLikeResume('Список покупок: молоко, хлеб')).toBe(false);
  });
});

describe('htmlText', () => {
  it('keeps the visible text and the line breaks of blocks', () => {
    expect(htmlText('<h1>Title</h1><style>p{}</style><div>One</div><div>Two</div>')).toBe('Title\nOne\nTwo');
  });
});
