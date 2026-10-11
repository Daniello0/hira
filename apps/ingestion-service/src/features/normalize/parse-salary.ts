export interface ParsedSalary {
  min: number | null;
  max: number | null;
  currency: string | null;
  gross: null;
}

const EMPTY_SALARY: ParsedSalary = { min: null, max: null, currency: null, gross: null };

/** Reads a salary phrase from an HTML card. An absent number stays empty. */
export function parseSalaryText(value: string | null): ParsedSalary {
  if (value === null || !/\d/.test(value)) return EMPTY_SALARY;
  const numbers = readNumbers(value);
  if (numbers.length === 0) return EMPTY_SALARY;
  return {
    min: numbers[0] ?? null,
    max: openEnded(value) ? null : (numbers[1] ?? numbers[0] ?? null),
    currency: readCurrency(value),
    gross: null,
  };
}

function readNumbers(value: string): number[] {
  const matches = value.match(/\d{1,3}(?: \d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g) ?? [];
  return matches.map((item) => Number(item.replace(/ /g, '').replace(',', '.')));
}

function openEnded(value: string): boolean {
  return /от\s+\d/i.test(value);
}

function readCurrency(value: string): string | null {
  if (/usd|\$/i.test(value)) return 'USD';
  if (/eur|€/i.test(value)) return 'EUR';
  if (/₽|rub/i.test(value)) return 'RUB';
  if (/\bbr\b/i.test(value) || /руб|byn/i.test(value)) return 'BYN';
  return null;
}
