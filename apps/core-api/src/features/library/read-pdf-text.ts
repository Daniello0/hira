import { extractText, getDocumentProxy } from 'unpdf';
import { PDF_UNREADABLE_MESSAGE } from '../memory/memory.constants';
import { LibraryInputError } from './library.service';

/** pdf.js errors that mean the upload itself is broken: not a PDF, damaged, or locked with a password. */
const UNREADABLE_PDF_ERRORS: ReadonlySet<string> = new Set(['InvalidPDFException', 'PasswordException', 'UnknownErrorException']);

/**
 * Reads PDF text locally. The file is not sent to the language model.
 * pdf.js maps some glyphs to U+0000, which PostgreSQL text cannot store, so each one becomes a space.
 */
export async function readPdfText(bytes: Buffer): Promise<string> {
  const text = await extract(bytes);
  return text.replaceAll('\u0000', ' ').trim();
}

async function extract(bytes: Buffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const extracted = await extractText(pdf, { mergePages: true });
    return Array.isArray(extracted.text) ? extracted.text.join('\n') : extracted.text;
  } catch (error) {
    if (UNREADABLE_PDF_ERRORS.has(errorName(error))) throw new LibraryInputError(PDF_UNREADABLE_MESSAGE);
    throw error;
  }
}

function errorName(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
}
