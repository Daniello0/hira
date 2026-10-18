import { describe, expect, it } from 'vitest';
import type { DataSource } from 'typeorm';
import { TypeOrmCallStore } from './typeorm-call.store';

const CALL_ID = 'call-1';
const USER_ID = 'user-1';

describe('call end', () => {
  it('keeps the first end time when two ends overlap', async () => {
    const db = new RacingCalls();
    const store = new TypeOrmCallStore(db as unknown as DataSource);
    const first = new Date('2026-10-18T12:00:01.000Z');
    const second = new Date('2026-10-18T12:00:02.000Z');
    const [left, right] = await Promise.all([
      store.endSession(CALL_ID, USER_ID, first),
      store.endSession(CALL_ID, USER_ID, second),
    ]);
    expect(db.endedAt?.toISOString()).toBe(first.toISOString());
    expect(left?.endedAt?.toISOString()).toBe(first.toISOString());
    expect(right?.endedAt?.toISOString()).toBe(first.toISOString());
  });
});

/** Two reads can both see an open call before either update lands. */
class RacingCalls {
  endedAt: Date | null = null;
  private readonly startedAt = new Date('2026-10-18T12:00:00.000Z');

  /** @inheritdoc */
  query(statement: string, params: unknown[] = []): Promise<unknown> {
    if (statement.includes('UPDATE')) return Promise.resolve(this.finish(statement, params));
    return Promise.resolve([this.session()]);
  }

  private finish(statement: string, params: unknown[]): unknown {
    const at = new Date(String(params[2]));
    if (statement.includes('ended_at IS NULL') && this.endedAt !== null) return [[], 0];
    this.endedAt = at;
    return [[this.session()], 1];
  }

  private session(): Record<string, unknown> {
    return {
      id: CALL_ID,
      userId: USER_ID,
      startedAt: this.startedAt.toISOString(),
      endedAt: this.endedAt?.toISOString() ?? null,
    };
  }
}
