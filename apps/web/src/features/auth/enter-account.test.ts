import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountLanding } from './enter-account';

describe('account landing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('opens the guest chat that moved into the account', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ chat: { id: 'c1' } }, { status: 201 })));
    expect(await accountLanding('token')).toBe('/chat/c1');
  });

  it('goes home when there was no guest chat', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ chat: null }, { status: 201 })));
    expect(await accountLanding('token')).toBe('/chat');
  });

  it('goes home when the move failed, so the sign-in still finishes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    expect(await accountLanding('token')).toBe('/chat');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })));
    expect(await accountLanding('token')).toBe('/chat');
  });
});
