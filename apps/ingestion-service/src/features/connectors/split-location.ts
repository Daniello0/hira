/** "Minsk, Minsk, Belarus" → city Minsk, country Belarus. A single word is a country or "Remote". */
export function splitLocation(raw: string | null): {
  raw: string | null;
  city: string | null;
  country: string | null;
} {
  if (raw === null) return { raw, city: null, country: null };
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length < 2)
    return { raw, city: null, country: isRemoteWord(raw) ? null : (parts[0] ?? null) };
  return { raw, city: parts[0] ?? null, country: parts[parts.length - 1] ?? null };
}

function isRemoteWord(value: string): boolean {
  return /remote|worldwide|anywhere/i.test(value);
}
