import { parseSalaryText } from '../../normalize/parse-salary';
import { stripHtml } from '../../normalize/strip-html';
import { isArchivedVacancy } from '../archived-page';
import type { RawVacancy } from '../raw-vacancy';

export interface HabrListItem {
  externalId: string;
  title: string;
  companyName: string;
  salaryText: string | null;
  city: string | null;
}

const TITLE_LINK = /class="vacancy-card__title-link" href="(\/vacancies\/(\d+))"/;

/** Vacancy cards. Links into `/responses` are not vacancies. */
export function parseHabrList(html: string): HabrListItem[] {
  return html
    .split(/<div class="vacancy-card[ "]/i)
    .slice(1)
    .flatMap((block) => readCard(block));
}

/** Detail page. A page without the description block cannot be stored. */
export function parseHabrVacancy(html: string, externalId: string): RawVacancy {
  const description = matchOne(
    html,
    /<div class="vacancy-description__text">([\s\S]*?)<\/div>\s*<\/div>/i,
  );
  if (description === null) throw new Error('Habr detail has no description');
  const salaryText = stripHtml(matchOne(html, /class="basic-salary">([\s\S]*?)<\/div>/i) ?? '');
  const salary = parseSalaryText(salaryText);
  return {
    externalId,
    url: `https://career.habr.com/vacancies/${externalId}`,
    title: stripHtml(matchOne(html, /<h1 class="page-title__title">([\s\S]*?)<\/h1>/i) ?? ''),
    companyName: companyName(html),
    unp: null,
    region: null,
    city: readCity(html),
    descriptionHtml: description,
    seniorityRaw: null,
    employmentRaw: null,
    workFormatRaw: null,
    schedule: null,
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    isGross: salary.gross,
    publishedAt: null,
    archived: isArchivedVacancy(html),
  };
}

function readCard(block: string): HabrListItem[] {
  const link = TITLE_LINK.exec(block);
  const externalId = link?.[2];
  if (externalId === undefined) return [];
  const title = stripHtml(
    matchOne(block, /class="vacancy-card__title-link"[^>]*>([\s\S]*?)<\/a>/i) ?? '',
  );
  return [
    {
      externalId,
      title,
      companyName: stripHtml(matchOne(block, /class="link-comp[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ?? ''),
      salaryText:
        stripHtml(matchOne(block, /class="basic-salary">([\s\S]*?)<\/div>/i) ?? '') || null,
      city: readCity(block),
    },
  ];
}

function companyName(html: string): string {
  const block = matchOne(html, /class="vacancy-company__title">([\s\S]*?)<\/div>/i) ?? '';
  const named = matchOne(block, /<a class="link-comp[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
  return stripHtml(named ?? '');
}

function readCity(block: string): string | null {
  const marked = matchOne(
    block,
    /icon-placemark[\s\S]*?class="chip-with-icon__text">([\s\S]*?)<\/div>/i,
  );
  const text = stripHtml(marked ?? '');
  return text.length === 0 ? null : text;
}

function matchOne(value: string, pattern: RegExp): string | null {
  return pattern.exec(value)?.[1] ?? null;
}
