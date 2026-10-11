import { Inject, Injectable } from '@nestjs/common';
import {
  LOGIN_ATTEMPT_PREFIX,
  LOGIN_LOCK_PREFIX,
  LOGIN_PERMIT_PREFIX,
  LOGIN_WINDOW_SECONDS,
} from '../auth/auth.constants';
import { COUNTER_STORE, type CounterStore } from '../redis/counter.store';
import { longestWait, retryAfterForAttempt } from './login-backoff';

type LimitKind = 'ip' | 'email';

/** Five login attempts per minute on the IP and on the email, then an exponential lock. */
@Injectable()
export class LoginRateLimitService {
  constructor(@Inject(COUNTER_STORE) private readonly counters: CounterStore) {}

  /**
   * Counts a login on the IP and the email.
   * Five attempts in the window proceed. The next waits, and the one after that wait proceeds.
   * A miss after the wait arms a longer delay. Returns seconds to wait, or null to proceed.
   */
  async consume(ip: string, email: string): Promise<number | null> {
    const locked = await this.lockRetry(ip, email);
    if (locked !== null) return locked;
    const ipPermit = await this.permitOpen('ip', ip);
    const emailPermit = await this.permitOpen('email', email);
    const ipDelay = ipPermit ? null : await this.recordAttempt('ip', ip);
    const emailDelay = emailPermit ? null : await this.recordAttempt('email', email);
    const delay = longestWait(ipDelay, emailDelay);
    if (delay !== null) return delay;
    await this.dropPermits(ip, email, ipPermit, emailPermit);
    return null;
  }

  /** Drops counters after a successful login. */
  async clear(ip: string, email: string): Promise<void> {
    await this.counters.delete(...loginKeys(ip, email));
  }

  private async lockRetry(ip: string, email: string): Promise<number | null> {
    const ipTtl = await this.counters.ttl(lockKey('ip', ip));
    const emailTtl = await this.counters.ttl(lockKey('email', email));
    return longestWait(ipTtl, emailTtl);
  }

  private async permitOpen(kind: LimitKind, id: string): Promise<boolean> {
    return (await this.counters.ttl(permitKey(kind, id))) !== null;
  }

  private async recordAttempt(kind: LimitKind, id: string): Promise<number | null> {
    const count = await this.counters.increment(attemptKey(kind, id), LOGIN_WINDOW_SECONDS);
    const delay = retryAfterForAttempt(count);
    if (delay === null) return null;
    await this.armBackoff(kind, id, delay);
    return delay;
  }

  private async armBackoff(kind: LimitKind, id: string, delay: number): Promise<void> {
    await this.counters.setExpiring(lockKey(kind, id), '1', delay);
    await this.counters.setExpiring(permitKey(kind, id), '1', delay + LOGIN_WINDOW_SECONDS);
  }

  private async dropPermits(
    ip: string,
    email: string,
    ipPermit: boolean,
    emailPermit: boolean,
  ): Promise<void> {
    const keys: string[] = [];
    if (ipPermit) keys.push(permitKey('ip', ip));
    if (emailPermit) keys.push(permitKey('email', email));
    await this.counters.delete(...keys);
  }
}

function loginKeys(ip: string, email: string): string[] {
  return [
    attemptKey('ip', ip),
    attemptKey('email', email),
    lockKey('ip', ip),
    lockKey('email', email),
    permitKey('ip', ip),
    permitKey('email', email),
  ];
}

function attemptKey(kind: LimitKind, value: string): string {
  return `${LOGIN_ATTEMPT_PREFIX}${kind}:${value}`;
}

function lockKey(kind: LimitKind, value: string): string {
  return `${LOGIN_LOCK_PREFIX}${kind}:${value}`;
}

function permitKey(kind: LimitKind, value: string): string {
  return `${LOGIN_PERMIT_PREFIX}${kind}:${value}`;
}
