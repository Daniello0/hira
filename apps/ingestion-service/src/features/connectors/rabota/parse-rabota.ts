import { parseSalaryText } from '../../normalize/parse-salary';
import { stripHtml } from '../../normalize/strip-html';
import { isArchivedVacancy } from '../archived-page';
import type { RawVacancy } from '../raw-vacancy';

export interface RabotaListItem {
  externalId: string;
  path: string;
  title: string;
  companyName: string;
  address: string | null;
}

const CARD = /<article\b[^>]*data-qa="vacancy-serp__vacancy"/i;

/** Public vacancy cards. Promoted cards use a different `data-qa` and are skipped. */
export function parseRabotaList(html: string): RabotaListItem[] {
  return html.split(CARD).slice(1).flatMap(readCard);
}

/** Detail page. A missing title is a parse failure. */
export function parseRabotaVacancy(html: string, externalId: string): RawVacancy {
  const title = stripHtml(readQa(html, 'vacancy-title') ?? '');
  if (title.length === 0) throw new Error('rabota.by detail has no title');
  return vacancy(html, externalId, title);
}

function vacancy(html: string, externalId: string, title: string): RawVacancy {
  const salary = parseSalaryText(stripHtml(readDiv(html, 'vacancy-salary')));
  return {
    externalId,
    url: `https://rabota.by/vacancy/${externalId}`,
    title,
    companyName: stripHtml(readQa(html, 'vacancy-company-name') ?? ''),
    unp: null,
    region: null,
    city: cityOf(stripHtml(readQa(html, 'vacancy-view-raw-address') ?? '')),
    descriptionHtml: readDiv(html, 'vacancy-description'),
    seniorityRaw: plain(readQa(html, 'vacancy-experience')),
    employmentRaw: plain(readQa(html, 'common-employment-text')),
    workFormatRaw: plain(readQa(html, 'work-formats-text')),
    schedule: plain(readQa(html, 'work-schedule-by-days-text')),
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    isGross: grossOf(html),
    publishedAt: null,
    archived: isArchivedVacancy(html),
  };
}

function readCard(block: string): RabotaListItem[] {
  const href = match(block, /data-qa="serp-item__title"[^>]*href="([^"]+)"/i);
  const externalId = href === null ? null : (/\/vacancy\/(\d+)/.exec(href)?.[1] ?? null);
  const title = stripHtml(readQa(block, 'serp-item__title-text') ?? '');
  if (externalId === null || title.length === 0) return [];
  return [
    {
      externalId,
      path: `/vacancy/${externalId}`,
      title,
      companyName: stripHtml(readQa(block, 'vacancy-serp__vacancy-employer-text') ?? ''),
      address: plain(readQa(block, 'vacancy-serp__vacancy-address')),
    },
  ];
}

function grossOf(html: string): boolean | null {
  if (html.includes('vacancy-salary-compensation-type-net')) return false;
  if (html.includes('vacancy-salary-compensation-type-gross')) return true;
  return null;
}

function cityOf(address: string): string | null {
  const city = address.split(',')[0]?.trim() ?? '';
  return city.length === 0 ? null : city;
}

function plain(value: string | null): string | null {
  const text = stripHtml(value ?? '');
  return text.length === 0 ? null : text;
}

function readQa(html: string, qa: string): string | null {
  const pattern = new RegExp(`data-qa="${qa}"[^>]*>([\\s\\S]*?)</`, 'i');
  return pattern.exec(html)?.[1] ?? null;
}

function readDiv(html: string, qa: string): string {
  const at = html.indexOf(`data-qa="${qa}"`);
  if (at < 0) return '';
  const open = html.indexOf('>', at);
  return open < 0 ? '' : innerDiv(html, open + 1);
}

function innerDiv(html: string, start: number): string {
  let depth = 1;
  let cursor = start;
  while (cursor < html.length && depth > 0) {
    const next = nextDiv(html, cursor);
    if (next === null) return html.slice(start);
    depth += next.opens ? 1 : -1;
    if (depth === 0) return html.slice(start, next.at);
    cursor = next.cursor;
  }
  return html.slice(start);
}

function nextDiv(
  html: string,
  from: number,
): { at: number; opens: boolean; cursor: number } | null {
  const source = html.toLowerCase();
  const open = source.indexOf('<div', from);
  const close = source.indexOf('</div', from);
  if (close < 0) return null;
  if (open >= 0 && open < close) return { at: open, opens: true, cursor: open + 4 };
  return { at: close, opens: false, cursor: close + 6 };
}

function match(value: string, pattern: RegExp): string | null {
  return pattern.exec(value)?.[1] ?? null;
}
