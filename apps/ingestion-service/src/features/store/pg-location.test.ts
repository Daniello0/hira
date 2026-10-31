import { OTHER_CITIES_REGION } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { resolveLocationId } from './pg-location';
import type { SqlClient } from './sql-client';

describe('resolveLocationId', () => {
  it('reuses the seeded oblast center when the region was not on the page', async () => {
    const sql: string[] = [];
    const client: SqlClient = {
      query: async (text, params) => {
        sql.push(text);
        expect(params).toEqual(['Минск']);
        return { rows: [{ id: 4 }] };
      },
    };
    expect(await resolveLocationId(client, { region: null, city: 'г. Минск' })).toBe(4);
    expect(sql.some((query) => query.includes('INSERT'))).toBe(false);
  });

  it('files a city it does not know under other cities, so the city is not lost', async () => {
    const inserted: unknown[][] = [];
    const client: SqlClient = {
      query: async (text, params) => {
        if (text.includes('INSERT')) {
          inserted.push(params ?? []);
          return { rows: [{ id: 99 }] };
        }
        if (text.includes('lower(city)')) return { rows: [] };
        return { rows: params?.[1] === null ? [{ id: 50 }] : [] };
      },
    };
    expect(await resolveLocationId(client, { region: null, city: 'Самара' })).toBe(99);
    expect(inserted).toEqual([[OTHER_CITIES_REGION, 'Самара', 50]]);
  });

  it('reuses a city already filed under other cities', async () => {
    const client: SqlClient = {
      query: async (text, params) => {
        if (text.includes('lower(city)')) return { rows: [] };
        return { rows: params?.[1] === 'Самара' ? [{ id: 99 }] : [{ id: 50 }] };
      },
    };
    expect(await resolveLocationId(client, { region: null, city: 'Самара' })).toBe(99);
  });

  it('gives up without the other-cities group and without a city', async () => {
    const client: SqlClient = { query: async () => ({ rows: [] }) };
    expect(await resolveLocationId(client, { region: null, city: 'Самара' })).toBeNull();
    expect(await resolveLocationId(client, { region: null, city: null })).toBeNull();
  });
});
