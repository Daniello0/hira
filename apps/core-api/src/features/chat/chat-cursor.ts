const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for the uuid shape used as a page cursor. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export interface PageCursor {
  at: Date;
  id: string;
}

/** Opaque cursor of `(timestamp, id)`. Newest pages walk toward older rows. */
export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`, 'utf8').toString('base64url');
}

/** Returns null when the cursor was not produced by `encodeCursor`. */
export function decodeCursor(value: string): PageCursor | null {
  const text = decode(value);
  if (text === null) return null;
  const splitAt = text.lastIndexOf('|');
  if (splitAt <= 0) return null;
  const at = new Date(text.slice(0, splitAt));
  const id = text.slice(splitAt + 1);
  if (Number.isNaN(at.getTime()) || !UUID.test(id)) return null;
  return { at, id };
}

/**
 * True when `row` is strictly older than the cursor.
 * Same instant breaks ties by id, matching the SQL `updated_at, id` order.
 */
export function isBeforeCursor(row: { at: Date; id: string }, cursor: PageCursor): boolean {
  const delta = row.at.getTime() - cursor.at.getTime();
  if (delta !== 0) return delta < 0;
  return row.id < cursor.id;
}

/** Keeps `limit` rows and a cursor when another row remains. */
export function takePage<T extends { at: Date; id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  const nextCursor = rows.length > limit && last !== undefined ? encodeCursor(last.at, last.id) : null;
  return { items, nextCursor };
}

function decode(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}
