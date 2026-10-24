import { parseSalaryText } from '../../normalize/parse-salary';
import { distinctBy, matchOne, plainText, readInnerDiv } from '../html-utils';
import { readJobPosting, type JobPostingLd } from '../job-posting-ld';
import type { RawVacancy, RawVacancyRef } from '../raw-vacancy';
import { splitLocation } from '../split-location';

export const INDEED_ORIGIN = 'https://www.indeed.com';
export const INDEED_PAGE_SIZE = 10;
export const INDEED_QUERY_REMOTE = 'remote-worldwide';

const JOB_KEY = /data-jk="([0-9a-f]{16})"/gi;
const EXPIRED_MARKS = [/This job has expired/i, /no longer available/i];

/**
 * Search page `page` (0-based). Only the remote query exists: Indeed has no Belarus site.
 * `start` sits mid-query because robots.txt allows `/*&start=N&` for N ≤ 90 only.
 */
export function indeedListPath(query: string, page: number): string | null {
  if (query !== INDEED_QUERY_REMOTE) return null;
  if (page === 0) return '/jobs?q=&l=Remote';
  return `/jobs?q=&start=${page * INDEED_PAGE_SIZE}&l=Remote`;
}

/** Public job page of one job key. */
export function indeedDetailPath(externalId: string): string {
  return `/viewjob?jk=${externalId}`;
}

/** Job keys of a search page. */
export function parseIndeedList(html: string, query: string): RawVacancyRef[] {
  const remoteWorldwide = query === INDEED_QUERY_REMOTE;
  const refs = [...html.matchAll(JOB_KEY)].map((match) => ({
    externalId: (match[1] ?? '').toLowerCase(),
    remoteWorldwide,
  }));
  return distinctBy(refs, (ref) => ref.externalId);
}

/** Job page: JobPosting JSON-LD first, visible markup as a fallback. */
export function parseIndeedVacancy(html: string, ref: RawVacancyRef): RawVacancy {
  const ld = readJobPosting(html);
  const title =
    ld?.title ?? plainText(matchOne(html, /jobsearch-JobInfoHeader-title[^>]*>([\s\S]*?)<\/h1>/i));
  if (title === null) throw new Error('Indeed detail has no title');
  const place = placeOf(html, ld);
  const payText = plainText(matchOne(html, /id="salaryInfoAndJobType"[^>]*>([\s\S]*?)<\/div>/i));
  return {
    externalId: ref.externalId,
    url: `${INDEED_ORIGIN}${indeedDetailPath(ref.externalId)}`,
    title,
    companyName: ld?.companyName ?? companyOf(html),
    unp: null,
    region: null,
    city: place.city,
    descriptionHtml: ld?.descriptionHtml ?? readInnerDiv(html, 'id="jobDescriptionText"') ?? '',
    seniorityRaw: null,
    employmentRaw: ld?.employmentType ?? null,
    workFormatRaw: ld?.remote === true || ref.remoteWorldwide === true ? 'Remote' : null,
    schedule: null,
    ...payOf(ld, payText),
    publishedAt: ld?.datePosted ?? null,
    archived: isIndeedExpired(html),
    country: place.country,
    remoteWorldwide: ref.remoteWorldwide === true,
    payText,
  };
}

/** True when Indeed says the job expired. */
export function isIndeedExpired(html: string): boolean {
  return EXPIRED_MARKS.some((mark) => mark.test(html));
}

function placeOf(
  html: string,
  ld: JobPostingLd | null,
): { city: string | null; country: string | null } {
  if (ld !== null && (ld.city !== null || ld.country !== null)) {
    return { city: ld.city, country: ld.country };
  }
  const shown = plainText(
    matchOne(html, /data-testid="inlineHeader-companyLocation"[^>]*>([\s\S]*?)<\/div>/i),
  );
  const place = splitLocation(shown);
  return { city: place.city, country: place.country };
}

function companyOf(html: string): string {
  const named = matchOne(html, /data-company-name="true"[^>]*>([\s\S]*?)<\/(?:a|span|div)>/i);
  return plainText(named) ?? '';
}

function payOf(ld: JobPostingLd | null, payText: string | null) {
  const pay = ld?.pay ?? null;
  if (pay !== null && pay.rateUnit !== null) {
    return {
      ...emptySalary(),
      salaryCurrency: pay.currency,
      rateAmount: pay.min,
      rateUnit: pay.rateUnit,
    };
  }
  if (pay !== null) {
    return { salaryMin: pay.min, salaryMax: pay.max, salaryCurrency: pay.currency, isGross: null };
  }
  const salary = parseSalaryText(payText);
  return {
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    isGross: null,
  };
}

function emptySalary() {
  return { salaryMin: null, salaryMax: null, salaryCurrency: null, isGross: null };
}
