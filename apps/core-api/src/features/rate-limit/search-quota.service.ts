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
 * Demo is 3 searches for the life of the session. Registered accounts get 20 per UTC day.
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

  /** Consumes one registered search. A denial reports the seconds until UTC midnight. */
  async consumeRegistered(userId: string): Promise<QuotaConsumption> {
    const now = this.clock.now();
    const count = await this.counters.increment(
      userQuotaKey(userId, now),
      secondsUntilUtcMidnight(now),
    );
    const retryAfter = count > REGISTERED_SEARCH_LIMIT ? secondsUntilUtcMidnight(now) : null;
    return decideQuota(count, REGISTERED_SEARCH_LIMIT, retryAfter);
  }
}
