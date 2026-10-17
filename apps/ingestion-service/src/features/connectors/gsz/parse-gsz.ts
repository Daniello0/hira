import { parseSalaryText } from '../../normalize/parse-salary';
import { stripHtml } from '../../normalize/strip-html';
import { isArchivedVacancy } from '../archived-page';
import type { RawVacancy } from '../raw-vacancy';

export interface GszListItem {
  externalId: string;
  path: string;
  title: string;
  companyName: string;
  salaryText: string | null;
  address: string | null;
}

const GSZ_SITE = 'https://gsz.gov.by';
const GSZ_VACANCY_ROOT = '/registration/vacancy/';
const PUBLIC_VACANCY_LINK = new RegExp(
  `<a href="(${GSZ_VACANCY_ROOT}([^"/?#]+)/)"[^>]*class="debounced-link"[^>]*>([\\s\\S]*?)</a>`,
  'i',
);

/** Public card path. The retired employer detail URL answers 404 for an open vacancy. */
export function gszVacancyPath(externalId: string): string {
  return `${GSZ_VACANCY_ROOT}${externalId}/`;
}

/** Public vacancy cards from a GSZ search page. Account links are ignored. */
export function parseGszList(html: string): GszListItem[] {
  return html
    .split(/<div class="job-block/i)
    .slice(1)
    .flatMap((block) => readCard(block));
}

/** Detail page. A missing title is a parse failure. */
export function parseGszVacancy(html: string, externalId: string): RawVacancy {
  const title = stripHtml(matchOne(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? '');
  if (title.length === 0) throw new Error('GSZ detail has no title');
  const address = stripHtml(matchOne(html, /<span class="address">([\s\S]*?)<\/span>/i) ?? '');
  const place = parseGszAddress(address);
  const salary = parseSalaryText(labeled(html, 'Заработная плата'));
  return {
    externalId,
    url: `${GSZ_SITE}${gszVacancyPath(externalId)}`,
    title,
    companyName: companyOf(html),
    unp: null,
    region: place.region,
    city: place.city,
    descriptionHtml: matchOne(html, /<ul class="job-overview">([\s\S]*?)<\/ul>/i) ?? html,
    seniorityRaw: null,
    employmentRaw: labeled(html, 'Характер работы'),
    workFormatRaw: null,
    schedule: null,
    ...salaryFields(salary),
    publishedAt: null,
    archived: isArchivedVacancy(html),
  };
}

/** Maps a GSZ workplace address onto the seeded region names. */
export function parseGszAddress(address: string): { region: string | null; city: string | null } {
  if (/г\.\s*минск/i.test(address) && !/обл\./i.test(address)) {
    return { region: 'Минск', city: 'Минск' };
  }
  const region = readOblast(address);
  const city = readSettlement(address);
  if (region === null && city === null) return { region: null, city: null };
  return { region, city };
}

function readCard(block: string): GszListItem[] {
  const link = PUBLIC_VACANCY_LINK.exec(block);
  const externalId = link?.[2];
  const title = stripHtml(link?.[3] ?? '');
  if (externalId === undefined || title.length === 0) return [];
  return [
    {
      externalId,
      path: gszVacancyPath(externalId),
      title,
      companyName: stripHtml(
        matchOne(block, /<li class="org[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ?? '',
      ),
      salaryText:
        stripHtml(matchOne(block, /<span class="salary">([\s\S]*?)<\/span>/i) ?? '') || null,
      address:
        stripHtml(matchOne(block, /<span class="address">([\s\S]*?)<\/span>/i) ?? '') || null,
    },
  ];
}

function companyOf(html: string): string {
  const named = matchOne(html, /business-entity\/[^"]+"[^>]*>[\s\S]*?<h5>([\s\S]*?)<\/h5>/i);
  return stripHtml(named ?? '');
}

function labeled(html: string, label: string): string | null {
  const pattern = new RegExp(`${label}</h5>\\s*<span[^>]*>([\\s\\S]*?)</span>`, 'i');
  const text = stripHtml(matchOne(html, pattern) ?? '');
  return text.length === 0 ? null : text;
}

function salaryFields(salary: ReturnType<typeof parseSalaryText>) {
  return {
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    isGross: salary.gross,
  };
}

function readOblast(address: string): string | null {
  const name = matchOne(address, /обл\.\s*([^,]+)/i)
    ?.trim()
    .toLowerCase();
  if (name === undefined) return null;
  const known: Record<string, string> = {
    брестская: 'Брестская область',
    витебская: 'Витебская область',
    гомельская: 'Гомельская область',
    гродненская: 'Гродненская область',
    минская: 'Минская область',
    могилёвская: 'Могилёвская область',
    могилевская: 'Могилёвская область',
  };
  return known[name] ?? null;
}

function readSettlement(address: string): string | null {
  const named = matchOne(address, /(?:^|,\s*)г(?:п)?\.\s*([^,]+)/i);
  return named?.trim() ?? null;
}

function matchOne(value: string, pattern: RegExp): string | null {
  return pattern.exec(value)?.[1] ?? null;
}
