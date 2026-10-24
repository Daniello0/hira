import { RateUnit } from '@hira/contracts';

export interface ParsedRate {
  amount: number;
  unit: RateUnit;
}

const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

const AMOUNT = String.raw`(\d{1,3}(?:[ ,]\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)\s*(?:k\b)?`;
const RATE_UNITS: Array<{ unit: RateUnit; pattern: string }> = [
  {
    unit: RateUnit.Hour,
    pattern: String.raw`(?:/\s*(?:hr|hour|h)\b|/\s*час|per\s+hour|an\s+hour|hourly|в\s+час|за\s+час)`,
  },
  {
    unit: RateUnit.Day,
    pattern: String.raw`(?:/\s*day\b|/\s*день|per\s+day|a\s+day|daily|в\s+день|за\s+день)`,
  },
  { unit: RateUnit.Project, pattern: String.raw`(?:per\s+project|fixed[\s-]+price|за\s+проект)` },
];
const RANGE_TAIL = String.raw`(?:\s*(?:-|–|to)\s*[^\d\n]{0,3}[\d.,]+\s*k?)?`;
const DURATION =
  /(?:contract|project|duration|engagement|контракт\w*|проект\w*|длительност\w*)[^.\n\d]{0,40}?(\d{1,3})(?:\s*[-–]\s*\d{1,3})?\s*[-\s]?(years?|months?|weeks?|days?|лет|года?|месяц\w*|мес\.?|недел\w*|дн\w*|день)/i;
const DURATION_BEFORE =
  /(\d{1,3})\s*[-\s]?(years?|months?|weeks?|days?|месяц\w*|недел\w*)\s+(?:contract|project|engagement|контракт|проект)/i;

/** "$40/hr", "€300 per day", "500 BYN за проект" → amount and unit. Monthly pay is not a rate. */
export function parseRate(text: string | null | undefined): ParsedRate | null {
  if (text == null) return null;
  for (const { unit, pattern } of RATE_UNITS) {
    const match = new RegExp(`${AMOUNT}${RANGE_TAIL}[^\\d\\n]{0,12}?${pattern}`, 'i').exec(text);
    const amount = match === null ? null : amountOf(match[1] ?? '', match[0]);
    if (amount !== null) return { amount, unit };
  }
  return null;
}

/** "6-month contract", "project duration: 3 months", "контракт на 6 месяцев" → days. */
export function parseProjectDurationDays(text: string | null | undefined): number | null {
  if (text == null) return null;
  const match = DURATION.exec(text) ?? DURATION_BEFORE.exec(text);
  if (match === null) return null;
  const count = Number(match[1]);
  const days = count * daysPerUnit(match[2] ?? '');
  return Number.isFinite(days) && days > 0 ? days : null;
}

function amountOf(raw: string, whole: string): number | null {
  const value = Number(raw.replace(/[ ,](?=\d{3}\b)/g, '').replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  return /\d\s*k\b/i.test(whole) ? value * 1000 : value;
}

function daysPerUnit(unit: string): number {
  const text = unit.toLowerCase();
  if (/^(?:year|лет|год)/.test(text)) return DAYS_PER_YEAR;
  if (/^(?:month|месяц|мес)/.test(text)) return DAYS_PER_MONTH;
  if (/^(?:week|недел)/.test(text)) return DAYS_PER_WEEK;
  return 1;
}
