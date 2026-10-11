import { Inject, Injectable } from '@nestjs/common';
import {
  LOGIN_ATTEMPT_PREFIX,
  LOGIN_LOCK_PREFIX,
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
   * Records this attempt unless a lock is already active.
   * Returns the seconds the caller must wait, or null when the attempt may proceed.
   */
  async consume(ip: string, email: string): Promise<number | null> {
    const locked = await this.lockRetry(ip, email);
    if (locked !== null) return locked;
    return this.recordAttempt(ip, email);
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

  private async recordAttempt(ip: string, email: string): Promise<number | null> {
    const ipCount = await this.counters.increment(attemptKey('ip', ip), LOGIN_WINDOW_SECONDS);
    const emailCount = await this.counters.increment(
      attemptKey('email', email),
      LOGIN_WINDOW_SECONDS,
    );
    const ipDelay = retryAfterForAttempt(ipCount);
    const emailDelay = retryAfterForAttempt(emailCount);
    await this.writeLock('ip', ip, ipDelay);
    await this.writeLock('email', email, emailDelay);
    return longestWait(ipDelay, emailDelay);
  }

  private async writeLock(kind: LimitKind, id: string, delay: number | null): Promise<void> {
    if (delay === null) return;
    await this.counters.setExpiring(lockKey(kind, id), '1', delay);
  }
}

function loginKeys(ip: string, email: string): string[] {
  return [
    attemptKey('ip', ip),
    attemptKey('email', email),
    lockKey('ip', ip),
    lockKey('email', email),
  ];
}

function attemptKey(kind: LimitKind, value: string): string {
  return `${LOGIN_ATTEMPT_PREFIX}${kind}:${value}`;
}

function lockKey(kind: LimitKind, value: string): string {
  return `${LOGIN_LOCK_PREFIX}${kind}:${value}`;
}
