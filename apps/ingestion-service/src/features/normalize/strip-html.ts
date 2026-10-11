const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

/** Drops tags and script bodies, then decodes entities left in the text. */
export function stripHtml(value: string): string {
  const withoutScripts = value.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
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
