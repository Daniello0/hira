import { describe, expect, it } from 'vitest';
import { decideRefresh } from './refresh-decision';

const future = new Date('2026-11-11T00:00:00.000Z');
const now = new Date('2026-10-11T00:00:00.000Z');

describe('refresh decision', () => {
  it('rotates a live token', () => {
    expect(decideRefresh({ revokedAt: null, expiresAt: future }, now)).toBe('rotate');
  });

  it('treats an unknown or expired token as invalid', () => {
    expect(decideRefresh(null, now)).toBe('invalid');
    expect(decideRefresh({ revokedAt: null, expiresAt: now }, now)).toBe('invalid');
  });

  it('lets a token replaced moments ago through, so a second tab does not end the session', () => {
    const replaced = new Date(now.getTime() - 29_000);
    expect(decideRefresh({ revokedAt: replaced, expiresAt: future }, now)).toBe('grace');
    expect(decideRefresh({ revokedAt: now, expiresAt: future }, now)).toBe('grace');
  });

  it('treats an older revoked token as reuse', () => {
    const replaced = new Date(now.getTime() - 31_000);
    expect(decideRefresh({ revokedAt: replaced, expiresAt: future }, now)).toBe('reused');
  });

  it('gives a token ended by logout no grace', () => {
    expect(decideRefresh({ revokedAt: now, expiresAt: now }, now)).toBe('reused');
  });
});
