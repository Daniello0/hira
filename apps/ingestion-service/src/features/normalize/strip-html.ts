const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

/** Tags that end a paragraph: the description splitter cuts on the blank line they leave. */
const PARAGRAPH_END = /<\/(?:p|ul|ol|table|blockquote|section|article)\s*>/gi;
const PARAGRAPH_MARK = '\u0002';
const LINE_MARK = '\u0001';
/** A run of break marks and the spaces around them becomes one break. */
const BREAK_RUN = /\s*[\u0001\u0002][\s\u0001\u0002]*/g;
/** Tags that start a new line inside a paragraph (a heading stays glued to its body). */
const LINE_BREAK =
  /<br\s*\/?>|<\/?(?:li|div|tr|h[1-6]|p|ul|ol|table|blockquote|section|article)\b[^>]*>/gi;

/**
 * Drops tags and script bodies, then decodes entities left in the text. Block tags keep
 * their line breaks (`</p>` leaves a blank line); spaces collapse only within a line.
 */
export function stripHtml(value: string): string {
  const withoutScripts = value.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ');
  // Source newlines are plain whitespace in HTML; only tags decide where a line ends.
  const flat = withoutScripts.replace(/\s+/g, ' ');
  const marked = flat
    .replace(PARAGRAPH_END, ` ${PARAGRAPH_MARK} `)
    .replace(LINE_BREAK, ` ${LINE_MARK} `);
  const text = decodeEntities(marked.replace(/<[^>]+>/g, ' '));
  return text
    .replace(BREAK_RUN, (run) => (run.includes(PARAGRAPH_MARK) ? '\n\n' : '\n'))
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim();
}

/** Collapses every whitespace run, line breaks included. For comparing old flat texts. */
export function flattenWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeEntities(value: string): string {
  const unescaped = value.replace(/&amp;/gi, '&');
  const named = unescaped.replace(/&([a-z]+);/gi, (match, name: string) =>
    namedEntity(name, match),
  );
  return named.replace(/&#(\d+);/g, (match, code: string) => character(code, match));
}

function namedEntity(name: string, fallback: string): string {
  return NAMED_ENTITIES[name.toLowerCase()] ?? fallback;
}

function character(code: string, fallback: string): string {
  const value = Number(code);
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) return fallback;
  return String.fromCodePoint(value);
}
