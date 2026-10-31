import { UserRole, type CurrentUserDto } from '@hira/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accessToken, bootstrapSession, renewAccess } from './session-access';
import { useSession } from './session.store';
import { SessionStatus } from './session-status';

const USER: CurrentUserDto = {
  id: 'u1',
  email: 'a@b.c',
  displayName: null,
  role: UserRole.User,
  crossChatMemoryEnabled: true,
  searchQuota: { used: 0, limit: 20 },
} as CurrentUserDto;

function respond(refresh: () => Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/auth/refresh')) return refresh();
    return Response.json(USER);
  }));
}

describe('session access', () => {
  beforeEach(() => {
    useSession.setState({ status: SessionStatus.Unknown, accessToken: null, expiresAt: null, user: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('opens the account when the refresh cookie is accepted', async () => {
    respond(async () => Response.json({ accessToken: 't', expiresIn: 900 }));
    await bootstrapSession();
    expect(useSession.getState().status).toBe(SessionStatus.Account);
  });

  it('becomes a guest only when the server rejects the cookie', async () => {
    respond(async () => new Response('no', { status: 401 }));
    await bootstrapSession();
    expect(useSession.getState().status).toBe(SessionStatus.Anonymous);
  });

  it('does not lose the session while the API is unreachable, and tries again', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn(async () => {
      if (refresh.mock.calls.length === 1) throw new TypeError('fetch failed');
      return Response.json({ accessToken: 't', expiresIn: 900 });
    });
    respond(refresh);
    await bootstrapSession();
    expect(useSession.getState().status).toBe(SessionStatus.Unknown);
    await vi.runOnlyPendingTimersAsync();
    expect(useSession.getState().status).toBe(SessionStatus.Account);
  });

  it('treats a 5xx like an unreachable API', async () => {
    vi.useFakeTimers();
    respond(async () => new Response('down', { status: 503 }));
    await bootstrapSession();
    expect(useSession.getState().status).toBe(SessionStatus.Unknown);
    vi.clearAllTimers();
  });

  it('keeps an account signed in when a refresh cannot reach the API', async () => {
    useSession.setState({ status: SessionStatus.Account, accessToken: 'old', expiresAt: 1, user: USER });
    respond(async () => { throw new TypeError('fetch failed'); });
    expect(await accessToken()).toBe('old');
    expect(useSession.getState().status).toBe(SessionStatus.Account);
  });

  it('signs an account out when the server rejects the refresh', async () => {
    useSession.setState({ status: SessionStatus.Account, accessToken: 'old', expiresAt: 1, user: USER });
    respond(async () => new Response('no', { status: 401 }));
    expect(await accessToken()).toBeNull();
    expect(useSession.getState().status).toBe(SessionStatus.Anonymous);
  });

  it('runs a refresh under the browser lock so tabs take turns', async () => {
    const request = vi.fn(async (_name: string, run: () => Promise<unknown>) => run());
    vi.stubGlobal('navigator', { locks: { request } });
    respond(async () => Response.json({ accessToken: 't', expiresIn: 900 }));
    expect(await renewAccess()).toBe('t');
    expect(request).toHaveBeenCalledTimes(1);
  });
});
