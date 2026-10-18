import { extractText, getDocumentProxy } from 'unpdf';

/** Reads PDF text locally. The file is not sent to the language model. */
export async function readPdfText(bytes: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const extracted = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(extracted.text) ? extracted.text.join('\n') : extracted.text;
  return text.trim();
}
