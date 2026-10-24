import { parseSalaryText } from '../../normalize/parse-salary';
import { distinctBy, matchOne, plainText, readInnerDiv } from '../html-utils';
import type { RawVacancy, RawVacancyRef } from '../raw-vacancy';
import { splitLocation } from '../split-location';

export const LINKEDIN_ORIGIN = 'https://www.linkedin.com';
export const LINKEDIN_PAGE_SIZE = 25;
export const LINKEDIN_QUERY_BELARUS = 'belarus';
export const LINKEDIN_QUERY_REMOTE = 'remote-worldwide';

const GUEST_SEARCH = '/jobs-guest/jobs/api/seeMoreJobPostings/search';
const QUERY_STRING: Record<string, string> = {
  [LINKEDIN_QUERY_BELARUS]: 'keywords=&location=Belarus',
  // f_WT=2 is LinkedIn's "remote" workplace filter.
  [LINKEDIN_QUERY_REMOTE]: 'keywords=&location=Worldwide&f_WT=2',
};
const CARD_URN = 'data-entity-urn="urn:li:jobPosting:';
const CLOSED_MARKS = [/closed-job/i, /No longer accepting applications/i];

/** Guest search page `page` (0-based) of one query. */
export function linkedinListPath(query: string, page: number): string | null {
  const params = QUERY_STRING[query];
  if (params === undefined) return null;
  return `${GUEST_SEARCH}?${params}&start=${page * LINKEDIN_PAGE_SIZE}`;
}

/** Guest job posting fragment of one id. */
export function linkedinDetailPath(externalId: string): string {
  return `/jobs-guest/jobs/api/jobPosting/${externalId}`;
}

/** Job cards of a guest search fragment. */
export function parseLinkedinList(html: string, query: string): RawVacancyRef[] {
  const remoteWorldwide = query === LINKEDIN_QUERY_REMOTE;
  const cards = html
    .split(CARD_URN)
    .slice(1)
    .flatMap((block) => readCard(block, remoteWorldwide));
  return distinctBy(cards, (card) => card.externalId);
}

/** Guest job posting fragment. A missing title is a parse failure. */
export function parseLinkedinVacancy(html: string, ref: RawVacancyRef): RawVacancy {
  const title = plainText(
    matchOne(html, /class="[^"]*top-card-layout__title[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i),
  );
  if (title === null) throw new Error('LinkedIn detail has no title');
  const place = splitLocation(locationOf(html) ?? ref.city ?? null);
  const payText = plainText(
    matchOne(html, /class="[^"]*compensation__salary[^"]*"[^>]*>([\s\S]*?)<\/div>/i),
  );
  const salary = parseSalaryText(payText);
  return {
    externalId: ref.externalId,
    url: `${LINKEDIN_ORIGIN}/jobs/view/${ref.externalId}`,
    title,
    companyName: companyOf(html),
    unp: null,
    region: null,
    city: place.city,
    descriptionHtml: readInnerDiv(html, 'show-more-less-html__markup') ?? '',
    seniorityRaw: criterion(html, 'Seniority level'),
    employmentRaw: criterion(html, 'Employment type'),
    workFormatRaw: workFormatOf(title, place.raw, ref),
    schedule: null,
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    isGross: null,
    publishedAt: null,
    archived: isLinkedinClosed(html),
    country: place.country,
    remoteWorldwide: ref.remoteWorldwide === true,
    payText,
  };
}

/** True when the posting says it no longer accepts applications. */
export function isLinkedinClosed(html: string): boolean {
  return CLOSED_MARKS.some((mark) => mark.test(html));
}

function readCard(block: string, remoteWorldwide: boolean): RawVacancyRef[] {
  const externalId = matchOne(block, /^(\d+)"/);
  if (externalId === null) return [];
  const location = plainText(
    matchOne(block, /class="job-search-card__location">([\s\S]*?)<\/span>/i),
  );
  return [{ externalId, city: location, remoteWorldwide }];
}

function companyOf(html: string): string {
  const linked = matchOne(html, /class="[^"]*topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
  const plain = matchOne(html, /class="topcard__flavor"[^>]*>([\s\S]*?)<\/span>/i);
  return plainText(linked ?? plain) ?? '';
}

function locationOf(html: string): string | null {
  return plainText(
    matchOne(html, /class="topcard__flavor topcard__flavor--bullet"[^>]*>([\s\S]*?)<\/span>/i),
  );
}

function criterion(html: string, name: string): string | null {
  const pattern = new RegExp(
    `job-criteria-subheader[^>]*>\\s*${name}\\s*</h3>\\s*<span[^>]*>([\\s\\S]*?)</span>`,
    'i',
  );
  return plainText(matchOne(html, pattern));
}

function workFormatOf(title: string, location: string | null, ref: RawVacancyRef): string | null {
  if (ref.remoteWorldwide === true) return 'Remote';
  const text = `${title} ${location ?? ''}`;
  if (/hybrid/i.test(text)) return 'Hybrid';
  if (/remote/i.test(text)) return 'Remote';
  return null;
}
