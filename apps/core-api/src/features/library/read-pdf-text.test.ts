import { describe, expect, it } from 'vitest';
import { PDF_UNREADABLE_MESSAGE } from '../memory/memory.constants';
import { LibraryInputError } from './library.service';
import { readPdfText } from './read-pdf-text';

describe('readPdfText', () => {
  it('turns the U+0000 that pdf.js gives some glyphs into spaces, so PostgreSQL can store the text', async () => {
    const text = await readPdfText(pdfWithNulSpaces(['John Carter', 'Node TypeScript']));
    expect(text).not.toContain('\u0000');
    expect(text).toBe('John Carter\nNode TypeScript');
  });

  it('reports a file that is not a PDF as an input error', async () => {
    const failure = await failureOf(readPdfText(Buffer.from('{\\rtf1 resume renamed to .pdf}')));
    expect(failure).toBeInstanceOf(LibraryInputError);
    expect(failure.message).toBe(PDF_UNREADABLE_MESSAGE);
  });

  it('reports an empty upload as an input error', async () => {
    const failure = await failureOf(readPdfText(Buffer.alloc(0)));
    expect(failure).toBeInstanceOf(LibraryInputError);
    expect(failure.message).toBe(PDF_UNREADABLE_MESSAGE);
  });
});

async function failureOf(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected a rejection');
}

/** One-page Helvetica PDF whose ToUnicode CMap sends the space code to U+0000, as some generators do. */
function pdfWithNulSpaces(lines: readonly string[]): Buffer {
  const cmap = [
    '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
    '/CMapName /Adobe-Identity-UCS def /CMapType 2 def',
    '1 begincodespacerange <00> <FF> endcodespacerange',
    '1 beginbfchar <20> <0000> endbfchar',
    '1 beginbfrange <21> <7E> <0021> endbfrange',
    'endcmap CMapName currentdict /CMap defineresource pop end end',
  ].join('\n');
  const content = `BT /F1 14 Tf 72 720 Td ${lines.map((line) => `(${line}) Tj`).join(' 0 -20 Td ')} ET`;
  return pdfFile([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding /ToUnicode 6 0 R >>',
    stream(content),
    stream(cmap),
  ]);
}

/** Numbers the objects 1..n and writes a matching cross-reference table. ASCII only, so length is bytes. */
function pdfFile(objects: readonly string[]): Buffer {
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  const rows = offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${rows}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

function stream(content: string): string {
  return `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
}
