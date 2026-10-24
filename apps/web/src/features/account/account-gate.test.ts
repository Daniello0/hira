import { describe, expect, it } from 'vitest';
import { SessionStatus } from '../auth/session-status';
import { accountDestination, accountPending } from './account-gate';

describe('account gate', () => {
  it('sends a demo session to login and waits while the session is unknown', () => {
    expect(accountDestination(SessionStatus.Anonymous)).toBe('/login');
    expect(accountDestination(SessionStatus.Account)).toBeNull();
    expect(accountPending(SessionStatus.Unknown)).toBe(true);
    expect(accountPending(SessionStatus.Account)).toBe(false);
  });
});
