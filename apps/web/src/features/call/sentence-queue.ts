/** A piece shorter than this waits for the next one, so "г. Минск" or "1. Python" is not spoken on its own. */
const MIN_SENTENCE_CHARS = 24;
const SENTENCE_END = /[.!?…]+["»)]*(?=\s)|\n+/g;

/** Cuts finished sentences off the stream of tokens. What is still being written stays in `rest`. */
export function takeSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let start = 0;
  for (const match of buffer.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    if (buffer.slice(start, end).trim().length < MIN_SENTENCE_CHARS) continue;
    sentences.push(buffer.slice(start, end).trim());
    start = end;
  }
  return { sentences, rest: buffer.slice(start) };
}

/** Text as a voice should read it: no Markdown marks, no bare links. Empty when nothing is left to say. */
export function speakableText(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^\s*(?:#+|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/[*_`#|~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
