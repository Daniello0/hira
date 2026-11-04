import { deflateRawSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { LibraryInputError } from './library.service';
import { htmlText, looksLikeResume, readAttachment, readDocxText } from './read-attachment';

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

  it('collapses Windows line ends and blank runs, and hides a script left open', () => {
    expect(htmlText('<p>One</p>\r\n\r\n \t<p>Two\u00a0 words</p><SCRIPT>tail()')).toBe('One\nTwo words');
  });

  it('decodes number entities and survives one past Unicode', () => {
    expect(htmlText('<p>&#1055;&#x438;&#99999999;</p>')).toBe('Пи\uFFFD');
  });

  it('reads hostile pages in linear time', () => {
    // Each of these took from seconds to minutes with the backtracking patterns.
    expect(htmlText('\r'.repeat(200_000) + 'end')).toBe('end');
    expect(htmlText('<'.repeat(200_000))).toHaveLength(200_000);
    expect(htmlText('<script>'.repeat(50_000))).toBe('');
  });
});

describe('readDocxText', () => {
  it('reads the paragraphs of document.xml', () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>Опыт работы</w:t></w:r></w:p><w:p><w:r><w:t>Tom &amp; Jerry</w:t></w:r></w:p></w:body></w:document>';
    expect(readDocxText(zipOf('word/document.xml', Buffer.from(xml)))).toBe('Опыт работы\nTom & Jerry');
  });

  it('refuses a zip bomb instead of inflating it into memory', () => {
    const bomb = zipOf('word/document.xml', Buffer.alloc(40 * 1024 * 1024));
    expect(bomb.length).toBeLessThan(200_000);
    expect(() => readDocxText(bomb)).toThrow(LibraryInputError);
  });
});

/** A zip with one deflated entry, as a .docx is. */
function zipOf(name: string, content: Buffer): Buffer {
  const fileName = Buffer.from(name);
  const data = deflateRawSync(content);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(fileName.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(fileName.length, 28);
  central.writeUInt32LE(0, 42);
  const directoryAt = local.length + fileName.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + fileName.length, 12);
  end.writeUInt32LE(directoryAt, 16);
  return Buffer.concat([local, fileName, data, central, fileName, end]);
}
