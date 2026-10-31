import { UserPlan, UserRole, type CurrentUserDto } from '@hira/contracts';
import { describe, expect, it, vi } from 'vitest';
import { SessionStatus } from './session-status';
import {
  afterRefreshFailure,
  refreshAccess,
  shouldRefresh,
  shouldRepeatPost,
  tokenForRequest,
} from './session';

describe('session', () => {
  it('treats a failed refresh as anonymous', async () => {
    const request = vi.fn(async () => new Response('no', { status: 401 }));
    expect(await refreshAccess(request, 1_000)).toBeNull();
  });

  it('stores the access token from a successful refresh', async () => {
    const request = vi.fn(async () => Response.json({ accessToken: 'token', expiresIn: 900 }));
    expect(await refreshAccess(request, 1_000)).toEqual({
      accessToken: 'token',
      expiresAt: 901_000,
    });
  });

  it('repeats a 401 only when the turn is not stored yet', () => {
    expect(shouldRepeatPost(401, false)).toBe(true);
    expect(shouldRepeatPost(401, true)).toBe(false);
    expect(shouldRefresh(1_000, 950)).toBe(true);
    expect(shouldRefresh(120_000, 1_000)).toBe(false);
  });

  it('refreshes an account token inside the lead window and keeps a demo token', async () => {
    const refresh = vi.fn(async () => ({ accessToken: 'next', expiresAt: 2_000 }));
    const refreshed = await tokenForRequest(request(SessionStatus.Account, 1_000, 950, refresh));
    expect(refreshed).toEqual({
      kind: 'refreshed',
      grant: { accessToken: 'next', expiresAt: 2_000 },
      user: account(),
    });
    const demoRefresh = vi.fn();
    const demo = await tokenForRequest(request(SessionStatus.Anonymous, null, 950, demoRefresh));
    expect(demo).toEqual({ kind: 'current', token: null });
    expect(demoRefresh).not.toHaveBeenCalled();
  });

  it('keeps the current token when refresh cannot be reached', async () => {
    const refresh = vi.fn(async () => {
      throw new Error('offline');
    });
    const decision = await tokenForRequest(request(SessionStatus.Account, 50_000, 1_000, refresh));
    expect(decision).toEqual({ kind: 'current', token: 'token' });
  });

  it('stops only after the access token is already expired', () => {
    expect(afterRefreshFailure(50_000, 1_000)).toBe('use-current');
    expect(afterRefreshFailure(500, 1_000)).toBe('sign-out');
  });
});

function request(
  status: SessionStatus,
  expiresAt: number | null,
  now: number,
  refresh: () => Promise<{ accessToken: string; expiresAt: number } | null>,
) {
  return {
    status,
    accessToken: status === SessionStatus.Account ? 'token' : null,
    expiresAt,
    now,
    refresh,
    loadUser: async () => account(),
  };
}

function account(): CurrentUserDto {
  return {
    id: 'u',
    email: 'ada@example.com',
    displayName: null,
    role: UserRole.User,
    plan: UserPlan.Free,
    crossChatMemoryEnabled: true,
    searchQuota: { used: 0, limit: 20 },
  };
}
