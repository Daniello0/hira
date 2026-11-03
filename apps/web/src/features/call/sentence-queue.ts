/** A piece shorter than this waits for the next one, so "г. Минск" or "1. Python" is not spoken on its own. */
const MIN_SENTENCE_CHARS = 24;
const SENTENCE_END = /[.!?…]+["»)]*(?=\s)|\n+/g;
/** The first piece of a reply may end at a comma or a colon once it is this long, so the voice starts sooner. */
const FIRST_CLAUSE_CHARS = 40;
const CLAUSE_END = /[,;:]["»)]*(?=\s)/g;

/**
 * Cuts finished sentences off the stream of tokens. What is still being written stays in `rest`.
 * `firstPiece` lets the reply's opening piece end at a clause instead of waiting for its whole sentence.
 */
export function takeSentences(buffer: string, firstPiece = false): { sentences: string[]; rest: string } {
  if (firstPiece) {
    const clause = firstClause(buffer);
    if (clause !== null) {
      const after = takeSentences(buffer.slice(clause));
      return { sentences: [buffer.slice(0, clause).trim(), ...after.sentences], rest: after.rest };
    }
  }
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

/** End of the first clause or sentence long enough to speak, or null while it is still being written. */
function firstClause(buffer: string): number | null {
  for (const match of buffer.matchAll(new RegExp(`${CLAUSE_END.source}|${SENTENCE_END.source}`, 'g'))) {
    const end = match.index + match[0].length;
    if (buffer.slice(0, end).trim().length >= FIRST_CLAUSE_CHARS) return end;
  }
  return null;
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
