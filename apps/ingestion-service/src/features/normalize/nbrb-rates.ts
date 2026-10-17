import type { HttpGet } from '../connectors/collect-source';
import { isRecord } from '../connectors/record';
import { NBRB_RATES_URL, RATE_TIME_ZONE } from '../ingestion.constants';

interface CachedRates {
  day: string;
  rates: Record<string, number>;
}

/** Official NBRB quote → BYN for one unit of each currency. BYN itself is omitted. */
export function parseNbrbRates(body: unknown): Record<string, number> {
  if (!Array.isArray(body)) throw new Error('NBRB rates are not a list');
  const rates: Record<string, number> = {};
  for (const row of body) remember(rates, row);
  return rates;
}

/** Downloads today's rates. A non-OK status fails the load. */
export async function fetchNbrbRates(http: HttpGet): Promise<Record<string, number>> {
  const response = await http.get(NBRB_RATES_URL, { Accept: 'application/json' });
  if (response.status >= 400) throw new Error(`NBRB HTTP ${response.status}`);
  return parseNbrbRates(JSON.parse(response.body) as unknown);
}

/** Keeps one successful load for the Minsk calendar day. */
export function createDailyRates(
  load: () => Promise<Record<string, number>>,
  now: () => Date,
): () => Promise<Record<string, number>> {
  let cached: CachedRates | null = null;
  return () =>
    loadForDay(
      load,
      now,
      () => cached,
      (next) => {
        cached = next;
      },
    );
}

async function loadForDay(
  load: () => Promise<Record<string, number>>,
  now: () => Date,
  read: () => CachedRates | null,
  write: (cached: CachedRates) => void,
): Promise<Record<string, number>> {
  const day = minskDay(now());
  const cached = read();
  if (cached !== null && cached.day === day) return cached.rates;
  const rates = await load();
  write({ day, rates });
  return rates;
}

function minskDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: RATE_TIME_ZONE }).format(now);
}

function remember(rates: Record<string, number>, row: unknown): void {
  const rate = readRate(row);
  if (rate === null || rate.code === 'BYN') return;
  rates[rate.code] = rate.perUnit;
}

function readRate(row: unknown): { code: string; perUnit: number } | null {
  if (!isRecord(row)) return null;
  const code = row.Cur_Abbreviation;
  const scale = row.Cur_Scale;
  const official = row.Cur_OfficialRate;
  if (!isCode(code) || !isPositive(scale) || !isFiniteNumber(official)) return null;
  return { code, perUnit: official / scale };
}

function isCode(value: unknown): value is string {
  return typeof value === 'string' && value.length === 3;
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
