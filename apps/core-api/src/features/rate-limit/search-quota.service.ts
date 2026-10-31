import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../common/utils/clock';
import {
  DEMO_QUOTA_PREFIX,
  DEMO_SEARCH_LIMIT,
  isDemoSessionId,
  REGISTERED_SEARCH_LIMIT,
} from '../auth/auth.constants';
import { COUNTER_STORE, type CounterStore } from '../redis/counter.store';
import {
  decideQuota,
  secondsUntilUtcMidnight,
  userQuotaKey,
  type QuotaConsumption,
} from './search-quota';

/**
 * Search quotas from Wiki/05 §1.6.
 * Demo is 3 searches for the life of the session. Registered accounts get their plan's limit per UTC day.
 * Chat and call routes consume a quota when they run a search; this service is that counter.
 */
@Injectable()
export class SearchQuotaService {
  constructor(
    @Inject(COUNTER_STORE) private readonly counters: CounterStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Consumes one demo search. The limit does not reset, so there is no `Retry-After`. */
  async consumeDemo(sessionId: string): Promise<QuotaConsumption> {
    if (!isDemoSessionId(sessionId)) {
      throw new Error('Demo session id is invalid');
    }
    const count = await this.counters.increment(`${DEMO_QUOTA_PREFIX}${sessionId}`, null);
    return decideQuota(count, DEMO_SEARCH_LIMIT, null);
  }

  /** Reads the demo counter without spending it. */
  async peekDemo(sessionId: string): Promise<QuotaConsumption> {
    const count = await this.counters.read(`${DEMO_QUOTA_PREFIX}${sessionId}`);
    return decideQuota((count ?? 0) + 1, DEMO_SEARCH_LIMIT, null);
  }

  /** Reads today's counter without spending it. A spent day reports the seconds until UTC midnight. */
  async peekRegistered(userId: string, limit: number = REGISTERED_SEARCH_LIMIT): Promise<QuotaConsumption> {
    const { used } = await this.readRegistered(userId, limit);
    return decideQuota(used + 1, limit, secondsUntilUtcMidnight(this.clock.now()));
  }

  /**
   * Searches already used today. A missing key is zero.
   * This does not call `increment`.
   */
  async readRegistered(userId: string, limit: number = REGISTERED_SEARCH_LIMIT): Promise<{ used: number; limit: number }> {
    const count = await this.counters.read(userQuotaKey(userId, this.clock.now()));
    return { used: count ?? 0, limit };
  }

  /** Consumes one registered search. A denial reports the seconds until UTC midnight. */
  async consumeRegistered(userId: string, limit: number = REGISTERED_SEARCH_LIMIT): Promise<QuotaConsumption> {
    const now = this.clock.now();
    const count = await this.counters.increment(
      userQuotaKey(userId, now),
      secondsUntilUtcMidnight(now),
    );
    const retryAfter = count > limit ? secondsUntilUtcMidnight(now) : null;
    return decideQuota(count, limit, retryAfter);
  }
}
