import { describe, expect, it, vi } from 'vitest';
import { refreshAccess, shouldRefresh, shouldRepeatPost } from './session';

describe('session', () => {
  it('treats a failed refresh as anonymous', async () => {
    const request = vi.fn(async () => new Response('no', { status: 401 }));
    expect(await refreshAccess(request, 1_000)).toBeNull();
  });

  it('stores the access token from a successful refresh', async () => {
    const request = vi.fn(async () => Response.json({ accessToken: 'token', expiresIn: 900 }));
    expect(await refreshAccess(request, 1_000)).toEqual({ accessToken: 'token', expiresAt: 901_000 });
  });

  it('repeats a 401 only when the turn is not stored yet', () => {
    expect(shouldRepeatPost(401, false)).toBe(true);
    expect(shouldRepeatPost(401, true)).toBe(false);
    expect(shouldRefresh(1_000, 950)).toBe(true);
    expect(shouldRefresh(120_000, 1_000)).toBe(false);
  });
});
