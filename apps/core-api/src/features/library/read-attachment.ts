import { inflateRawSync } from 'node:zlib';
import { ATTACHMENT_TEXT_MAX_CHARS, type ReadAttachmentDto } from '@hira/contracts';
import { LibraryInputError } from './library.service';
import type { PdfReader } from './library.store';

/** A file put into a chat message. */
export interface AttachmentFile {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
}

/** Reads a picture to text: what is written on it and what it shows. */
export type ImageReader = (image: Buffer, type: string) => Promise<string>;

export const ATTACHMENT_UNSUPPORTED_MESSAGE = 'This file type cannot be read. Send a PDF, a Word file, a picture, or a text file such as CSV, HTML, or Markdown.';
export const ATTACHMENT_EMPTY_MESSAGE = 'The file has no text Hira can read.';

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'log', 'ini', 'rtf']);
const HTML_EXTENSIONS = new Set(['html', 'htm']);
const IMAGE_TYPES: Readonly<Record<string, string>> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
/** Headings a resume has in Russian or English. Two of them, or one with a contact line, make a resume. */
const RESUME_SECTIONS = [/опыт работы/i, /образование/i, /навыки/i, /work experience/i, /\bexperience\b/i, /\beducation\b/i, /\bskills\b/i, /резюме/i, /\bcurriculum vitae\b|\bCV\b|\bresume\b/i];
const CONTACT = /@[\w-]+\.[a-z]{2,}|\+?\d[\d\s()-]{8,}\d/i;

/** The text of a file for the chat, cut to what Hira reads, and whether it looks like a resume. */
export async function readAttachment(file: AttachmentFile, deps: { pdf: PdfReader; image: ImageReader }): Promise<ReadAttachmentDto> {
  const name = file.originalname?.trim() || 'file';
  const raw = (await fileText(file, name, deps)).replaceAll('\u0000', ' ').trim();
  if (raw.length === 0) throw new LibraryInputError(ATTACHMENT_EMPTY_MESSAGE);
  const truncated = raw.length > ATTACHMENT_TEXT_MAX_CHARS;
  const text = truncated ? raw.slice(0, ATTACHMENT_TEXT_MAX_CHARS) : raw;
  return { name, text, looksLikeResume: looksLikeResume(text), truncated };
}

async function fileText(file: AttachmentFile, name: string, deps: { pdf: PdfReader; image: ImageReader }): Promise<string> {
  const extension = name.toLowerCase().split('.').pop() ?? '';
  const type = file.mimetype ?? '';
  if (extension === 'pdf' || type === 'application/pdf') return deps.pdf.read(file.buffer);
  if (extension === 'docx') return readDocxText(file.buffer);
  const image = IMAGE_TYPES[extension] ?? (type.startsWith('image/') ? type : undefined);
  if (image !== undefined) return deps.image(file.buffer, image);
  if (HTML_EXTENSIONS.has(extension) || type === 'text/html') return htmlText(file.buffer.toString('utf8'));
  if (TEXT_EXTENSIONS.has(extension) || type.startsWith('text/')) return file.buffer.toString('utf8');
  throw new LibraryInputError(ATTACHMENT_UNSUPPORTED_MESSAGE);
}

/** Section headings, or a heading and a contact line, as a resume has. */
export function looksLikeResume(text: string): boolean {
  const head = text.slice(0, 6_000);
  const sections = RESUME_SECTIONS.filter((pattern) => pattern.test(head)).length;
  return sections >= 2 || (sections === 1 && CONTACT.test(head));
}

/** Visible text of a page: no scripts, styles, or tags, block ends as new lines. */
export function htmlText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** The paragraphs of a .docx: its `word/document.xml`, found in the zip without a library. */
export function readDocxText(docx: Buffer): string {
  const xml = zipEntry(docx, 'word/document.xml');
  if (xml === null) throw new LibraryInputError(ATTACHMENT_UNSUPPORTED_MESSAGE);
  return decodeEntities(
    xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  ).trim();
}

/** One file of a zip by its name, read through the central directory. Stored and deflated entries only. */
function zipEntry(zip: Buffer, wanted: string): string | null {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > zip.length) return null;
  let offset = zip.readUInt32LE(end + 16);
  const count = zip.readUInt16LE(end + 10);
  for (let index = 0; index < count && offset + 46 <= zip.length; index += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) return null;
    const method = zip.readUInt16LE(offset + 10);
    const size = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extra = zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
    const local = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (name === wanted && local + 30 <= zip.length) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      try {
        return (method === 0 ? data : inflateRawSync(data)).toString('utf8');
      } catch {
        return null;
      }
    }
    offset += 46 + nameLength + extra;
  }
  return null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}
