import { describe, expect, it } from 'vitest';
import { longestWait, retryAfterForAttempt } from './login-backoff';

describe('login backoff', () => {
  it('allows five attempts and then doubles the wait', () => {
    expect(retryAfterForAttempt(5)).toBeNull();
    expect(retryAfterForAttempt(6)).toBe(2);
    expect(retryAfterForAttempt(7)).toBe(4);
  });

  it('caps the wait at 15 minutes', () => {
    expect(retryAfterForAttempt(40)).toBe(15 * 60);
  });

  it('picks the longer of two waits', () => {
    expect(longestWait(null, null)).toBeNull();
    expect(longestWait(2, 8)).toBe(8);
  });
});
