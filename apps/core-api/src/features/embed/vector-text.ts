/** pgvector text. A null embedding stays null. */
export function formatVector(values: readonly number[] | null): string | null {
  if (values === null) return null;
  return `[${values.join(',')}]`;
}

/** Reads a pgvector value that came back as text or as a number list. */
export function parseVector(value: unknown): number[] | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.filter((item): item is number => typeof item === 'number');
  if (typeof value !== 'string' || !value.startsWith('[')) return null;
  const numbers = value.slice(1, -1).split(',').filter((part) => part.length > 0).map(Number);
  if (numbers.some((item) => !Number.isFinite(item))) return null;
  return numbers;
}
