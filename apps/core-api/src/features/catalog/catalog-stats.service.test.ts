import { describe, expect, it } from 'vitest';
import type { DataSource } from 'typeorm';
import { CatalogStatsService } from './catalog-stats.service';

function source(query: (sql: string) => unknown[]): { dataSource: DataSource; calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    dataSource: {
      query: async (sql: string) => {
        calls += 1;
        return query(sql);
      },
    } as unknown as DataSource,
  };
}

function answers(sql: string): unknown[] {
  if (sql.includes('"noLocation"')) return [{ total: 15, noLocation: 13, remote: 2, foreignRemote: 1 }];
  if (sql.includes('l.region AS name')) return [{ name: 'Минск', count: 2 }];
  if (sql.includes('l.city AS name')) return [{ name: 'Минск', count: 2 }];
  return [{ name: 'GSZ', count: 5 }];
}

describe('catalog stats', () => {
  it('counts vacancies in total, by region and city, remote, and by site', async () => {
    const db = source(answers);
    const service = new CatalogStatsService(db.dataSource, { now: () => new Date(0) });
    expect(await service.read()).toEqual({
      total: 15,
      noLocation: 13,
      remote: 2,
      foreignRemote: 1,
      byRegion: [{ region: 'Минск', count: 2 }],
      topCities: [{ city: 'Минск', count: 2 }],
      bySource: [{ source: 'GSZ', count: 5 }],
    });
  });

  it('reads the table again only after five minutes', async () => {
    const db = source(answers);
    let now = 0;
    const service = new CatalogStatsService(db.dataSource, { now: () => new Date(now) });
    await service.read();
    const once = db.calls();
    now = 4 * 60 * 1000;
    await service.read();
    expect(db.calls()).toBe(once);
    now = 6 * 60 * 1000;
    await service.read();
    expect(db.calls()).toBe(once * 2);
  });

  it('never stops a turn: a failed read gives the last counts, or null', async () => {
    let fail = true;
    const db = source((sql) => {
      if (fail) throw new Error('down');
      return answers(sql);
    });
    let now = 0;
    const service = new CatalogStatsService(db.dataSource, { now: () => new Date(now) });
    expect(await service.read()).toBeNull();
    fail = false;
    const good = await service.read();
    fail = true;
    now = 10 * 60 * 1000;
    expect(await service.read()).toEqual(good);
  });
});
