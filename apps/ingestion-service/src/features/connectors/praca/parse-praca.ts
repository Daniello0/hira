import { parseSalaryText } from '../../normalize/parse-salary';
import { distinctBy, matchOne, plainText, readInnerDiv } from '../html-utils';
import { readJobPosting, type JobPostingLd } from '../job-posting-ld';
import type { RawVacancy, RawVacancyRef } from '../raw-vacancy';

export const PRACA_ORIGIN = 'https://praca.by';

const CARD_LINK = 'class="vac-small__title-link"';
const ARCHIVED_MARKS = [/вакансия\s+(?:находится\s+)?в\s+архиве/i, /вакансия\s+закрыта/i];

/** Detail page path. praca.by ids are numeric and the path keeps the trailing slash. */
export function pracaVacancyPath(externalId: string): string {
  return `/vacancy/${externalId}/`;
}

/** Vacancy cards of a city list page (`/rabota-minsk/`). */
export function parsePracaList(html: string): RawVacancyRef[] {
  const cards = html.split(CARD_LINK).slice(1).flatMap(readCard);
  return distinctBy(cards, (card) => card.externalId);
}

/** Detail page: the visible markup first, the JobPosting JSON-LD as a fallback. */
export function parsePracaVacancy(html: string, ref: RawVacancyRef): RawVacancy {
  const ld = readJobPosting(html);
  const title = plainText(matchOne(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)) ?? ld?.title ?? '';
  if (title.length === 0) throw new Error('praca.by detail has no title');
  const payText = plainText(matchOne(html, /<div class="vacancy__salary">([\s\S]*?)<\/div>/i));
  const salary = parseSalaryText(payText);
  return {
    externalId: ref.externalId,
    url: `${PRACA_ORIGIN}${pracaVacancyPath(ref.externalId)}`,
    title,
    companyName: companyOf(html, ld),
    unp: null,
    region: null,
    city: cityOf(html, ld, ref),
    descriptionHtml:
      readInnerDiv(html, 'class="description wysiwyg-st"') ?? ld?.descriptionHtml ?? '',
    seniorityRaw: plainText(matchOne(html, /class="vacancy__experience">([\s\S]*?)<\/p>/i)),
    employmentRaw: labeled(html, 'Занятость') ?? ld?.employmentType ?? null,
    workFormatRaw: labeled(html, 'Характер работы'),
    schedule: labeled(html, 'График работы'),
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    isGross: grossOf(payText),
    publishedAt: ld?.datePosted ?? null,
    archived: isPracaArchived(html),
    payText,
  };
}

/** True when the page says the vacancy is archived or closed. */
export function isPracaArchived(html: string): boolean {
  return ARCHIVED_MARKS.some((mark) => mark.test(html));
}

function readCard(block: string): RawVacancyRef[] {
  const externalId = matchOne(block, /^\s*href="\/vacancy\/(\d+)\/"/);
  if (externalId === null) return [];
  const city = plainText(matchOne(block, /class="vac-small__city">([\s\S]*?)<\/div>/i));
  return [{ externalId, city }];
}

function companyOf(html: string, ld: JobPostingLd | null): string {
  const block = matchOne(html, /<div class="vacancy__org-name">([\s\S]*?)<\/div>/i);
  return plainText(block) ?? ld?.companyName ?? '';
}

function cityOf(html: string, ld: JobPostingLd | null, ref: RawVacancyRef): string | null {
  const shown = plainText(matchOne(html, /<div class="vacancy__city">([\s\S]*?)<\/div>/i));
  return shown ?? ld?.city ?? ref.city ?? null;
}

function labeled(html: string, label: string): string | null {
  const pattern = new RegExp(`<b>\\s*${label}:\\s*</b>([\\s\\S]*?)</div>`, 'i');
  return plainText(matchOne(html, pattern));
}

function grossOf(payText: string | null): boolean | null {
  if (payText === null) return null;
  if (/до вычета/i.test(payText)) return true;
  if (/на руки|после вычета/i.test(payText)) return false;
  return null;
}
