/** Reads rows from a TypeORM `query` result. UPDATE and DELETE come back as `[rows, count]`. */
export function typeormRows(result: unknown): Record<string, unknown>[] {
  if (isUpdateTuple(result)) return result[0];
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return [];
}

function isUpdateTuple(value: unknown): value is [Record<string, unknown>[], number | null] {
  return Array.isArray(value) && value.length === 2 && Array.isArray(value[0]) && (typeof value[1] === 'number' || value[1] === null);
}
