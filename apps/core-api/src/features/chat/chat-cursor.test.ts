import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, isBeforeCursor, takePage } from './chat-cursor';

const older = { at: new Date('2026-10-18T10:00:00.000Z'), id: '10000000-0000-4000-8000-000000000001' };
const newer = { at: new Date('2026-10-18T11:00:00.000Z'), id: '10000000-0000-4000-8000-000000000002' };
const tieLow = { at: newer.at, id: '10000000-0000-4000-8000-000000000001' };

describe('chat cursor', () => {
  it('round-trips a timestamp and an id', () => {
    expect(decodeCursor(encodeCursor(newer.at, newer.id))).toEqual({ at: newer.at, id: newer.id });
  });

  it('rejects a cursor this API did not issue', () => {
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(Buffer.from('nope', 'utf8').toString('base64url'))).toBeNull();
  });

  it('walks from newer rows toward older ones and breaks timestamp ties by id', () => {
    expect(isBeforeCursor(older, { at: newer.at, id: newer.id })).toBe(true);
    expect(isBeforeCursor(newer, { at: older.at, id: older.id })).toBe(false);
    expect(isBeforeCursor(tieLow, { at: newer.at, id: newer.id })).toBe(true);
    expect(isBeforeCursor(newer, { at: newer.at, id: newer.id })).toBe(false);
  });

  it('returns a cursor only when another row is left', () => {
    const page = takePage([newer, older], 1);
    expect(page.items).toEqual([newer]);
    expect(decodeCursor(page.nextCursor ?? '')).toEqual({ at: newer.at, id: newer.id });
    expect(takePage([newer], 1).nextCursor).toBeNull();
  });
});
