import { describe, expect, it } from 'vitest';
import type { HttpGet } from '../connectors/collect-source';
import { createDailyRates, fetchNbrbRates, parseNbrbRates } from './nbrb-rates';

const USD = { Cur_Abbreviation: 'USD', Cur_Scale: 1, Cur_OfficialRate: 3.2 };
const JPY = { Cur_Abbreviation: 'JPY', Cur_Scale: 100, Cur_OfficialRate: 2.1 };

describe('parseNbrbRates', () => {
  it('converts an official rate into BYN per one unit and skips BYN itself', () => {
    expect(
      parseNbrbRates([USD, JPY, { Cur_Abbreviation: 'BYN', Cur_Scale: 1, Cur_OfficialRate: 1 }]),
    ).toEqual({ USD: 3.2, JPY: 0.021 });
  });

  it('rejects a payload that is not a list', () => {
    expect(() => parseNbrbRates({ USD: 3 })).toThrow(/list/i);
  });
});

describe('fetchNbrbRates', () => {
  it('reads the daily NBRB list', async () => {
    const http: HttpGet = {
      get: async () => ({ status: 200, body: JSON.stringify([USD]) }),
    };
    expect(await fetchNbrbRates(http)).toEqual({ USD: 3.2 });
  });

  it('fails when the bank does not answer', async () => {
    const http: HttpGet = {
      get: async () => ({ status: 503, body: '' }),
    };
    await expect(fetchNbrbRates(http)).rejects.toThrow(/503/);
  });
});

describe('createDailyRates', () => {
  it('loads once per Minsk calendar day', async () => {
    let now = new Date('2026-10-17T20:30:00Z');
    let loads = 0;
    const rates = createDailyRates(
      async () => {
        loads += 1;
        return { USD: loads };
      },
      () => now,
    );
    expect(await rates()).toEqual({ USD: 1 });
    expect(await rates()).toEqual({ USD: 1 });
    now = new Date('2026-10-17T21:30:00Z');
    expect(await rates()).toEqual({ USD: 2 });
    expect(loads).toBe(2);
  });
});
