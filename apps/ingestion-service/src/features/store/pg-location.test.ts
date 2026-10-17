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

  it('does not invent a location for a city that is not in the dictionary', async () => {
    const client: SqlClient = {
      query: async () => ({ rows: [] }),
    };
    expect(await resolveLocationId(client, { region: null, city: 'Самара' })).toBeNull();
  });
});
