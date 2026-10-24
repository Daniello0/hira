const DIGRAPHS: ReadonlyArray<[string, string]> = [
  ['shch', 'щ'],
  ['sh', 'ш'],
  ['ch', 'ч'],
  ['zh', 'ж'],
  ['kh', 'х'],
  ['ts', 'ц'],
  ['ya', 'я'],
  ['yu', 'ю'],
  ['yo', 'ё'],
];

const LETTERS: Readonly<Record<string, string>> = {
  a: 'а',
  b: 'б',
  c: 'к',
  d: 'д',
  e: 'е',
  f: 'ф',
  g: 'г',
  h: 'х',
  i: 'и',
  j: 'й',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  q: 'к',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  v: 'в',
  w: 'в',
  x: 'кс',
  y: 'ы',
  z: 'з',
};

/**
 * Rough Latin → Cyrillic spelling, so "Minsk" or "Grodno" typed in the English UI finds the stored
 * Russian place names. Returns null when the text has no Latin letters.
 */
export function latinToCyrillic(text: string): string | null {
  if (!/[a-z]/i.test(text)) return null;
  let result = text.toLowerCase();
  for (const [latin, cyrillic] of DIGRAPHS) result = result.split(latin).join(cyrillic);
  return result.replace(/[a-z]/g, (letter) => LETTERS[letter] ?? letter);
}
