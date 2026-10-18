import type { CounterStore } from './counter.store';

interface Row {
  value: string;
  expiresAtMs: number | null;
}

/** Process-local counters. `now` lets tests expire keys without sleeping. */
export class MemoryCounterStore implements CounterStore {
  constructor(private readonly now: () => number = Date.now) {}

  private readonly rows = new Map<string, Row>();

  /** @inheritdoc */
  async increment(key: string, ttlSeconds: number | null): Promise<number> {
    const existing = this.live(key);
    const count = existing === null ? 1 : Number(existing.value) + 1;
    const expiresAtMs = existing === null ? this.expiry(ttlSeconds) : existing.expiresAtMs;
    this.rows.set(key, { value: String(count), expiresAtMs });
    return count;
  }

  /** @inheritdoc */
  async read(key: string): Promise<number | null> {
    const row = this.live(key);
    if (row === null) return null;
    return finite(row.value);
  }

  /** @inheritdoc */
  async ttl(key: string): Promise<number | null> {
    const row = this.live(key);
    if (row === null || row.expiresAtMs === null) return null;
    return Math.max(1, Math.ceil((row.expiresAtMs - this.now()) / 1000));
  }

  /** @inheritdoc */
  async setExpiring(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.rows.set(key, { value, expiresAtMs: this.now() + ttlSeconds * 1000 });
  }

  /** @inheritdoc */
  async delete(...keys: string[]): Promise<void> {
    for (const key of keys) this.rows.delete(key);
  }

  private expiry(ttlSeconds: number | null): number | null {
    if (ttlSeconds === null) return null;
    return this.now() + ttlSeconds * 1000;
  }

  private live(key: string): Row | null {
    const row = this.rows.get(key);
    if (row === undefined) return null;
    if (row.expiresAtMs !== null && row.expiresAtMs <= this.now()) {
      this.rows.delete(key);
      return null;
    }
    return row;
  }
}

function finite(value: string): number | null {
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}
