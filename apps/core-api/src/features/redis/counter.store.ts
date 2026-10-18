export const COUNTER_STORE = Symbol('COUNTER_STORE');

/** Integer counters with an optional TTL. Redis is the production implementation. */
export interface CounterStore {
  /**
   * Increments `key`.
   * `ttlSeconds` is applied only when the key is created. `null` leaves the key without an expiry.
   */
  increment(key: string, ttlSeconds: number | null): Promise<number>;

  /** Current integer, or `null` when the key is missing. Does not increment. */
  read(key: string): Promise<number | null>;

  /** Remaining TTL in seconds. `null` when the key is missing or has no expiry. */
  ttl(key: string): Promise<number | null>;

  /** Stores `value` and replaces any previous TTL. */
  setExpiring(key: string, value: string, ttlSeconds: number): Promise<void>;

  /** Removes every listed key. An empty list is a no-op. */
  delete(...keys: string[]): Promise<void>;
}
