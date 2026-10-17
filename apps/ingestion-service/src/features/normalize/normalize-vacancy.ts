import {
  EmploymentType,
  Language,
  SeniorityLevel,
  VacancySource,
  VacancyStatus,
  WorkFormat,
} from '@hira/contracts';
import type { RawVacancy } from '../connectors/raw-vacancy';
import { normalizeCompanyName } from './company-name';
import { dictionaryCity } from './dictionary-city';
import { conditionsText, contentHash, sourceHash } from './content-hash';
import { mapEmployment, mapSeniority, mapWorkFormat } from './map-enums';
import { stripHtml } from './strip-html';
import { simhash } from '../dedupe/simhash';

/** Canonical vacancy row ready for `vacancies`. `search_document` is not included. */
export interface CanonicalVacancy {
  source: VacancySource;
  language: Language;
  externalId: string;
  url: string | null;
  title: string;
  companyName: string;
  companyDisplayName: string;
  unp: string | null;
  region: string | null;
  city: string | null;
  description: string;
  descriptionRaw: string;
  seniority: SeniorityLevel | null;
  employment: EmploymentType | null;
  workFormat: WorkFormat | null;
  schedule: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  salaryMinByn: string | null;
  salaryMaxByn: string | null;
  isGross: boolean | null;
  isForeignRemote: false;
  status: VacancyStatus;
  publishedAt: string | null;
  contentHash: string;
  sourceHash: string;
  skillsText: '';
  simhash: string;
}

/** Maps one raw posting onto the shared vacancy columns. */
export function normalizeVacancy(
  raw: RawVacancy,
  rates: Record<string, number>,
  source: VacancySource = VacancySource.RabotaBy,
): CanonicalVacancy {
  const title = raw.title.trim();
  if (title.length === 0) throw new Error('vacancy title is empty');
  const description = stripHtml(raw.descriptionHtml);
  const workFormat = mapWorkFormat(raw.workFormatRaw);
  return buildCanonical(raw, source, title, description, workFormat, rates);
}

function buildCanonical(
  raw: RawVacancy,
  source: VacancySource,
  title: string,
  description: string,
  workFormat: WorkFormat | null,
  rates: Record<string, number>,
): CanonicalVacancy {
  return {
    ...identity(raw, source, title, description),
    ...pay(raw, rates),
    workFormat,
    seniority: mapSeniority(raw.seniorityRaw),
    employment: mapEmployment(raw.employmentRaw),
    schedule: raw.schedule,
    status: raw.archived ? VacancyStatus.Closed : VacancyStatus.Active,
    contentHash: hashOf(title, description, workFormat, raw.schedule),
    sourceHash: sourceHash({
      title,
      description,
      conditions: conditionsText(workFormat, raw.schedule),
    }),
    simhash: simhash(description),
  };
}

function identity(
  raw: RawVacancy,
  source: VacancySource,
  title: string,
  description: string,
): Pick<
  CanonicalVacancy,
  | 'source'
  | 'language'
  | 'externalId'
  | 'url'
  | 'title'
  | 'companyName'
  | 'companyDisplayName'
  | 'unp'
  | 'region'
  | 'city'
  | 'description'
  | 'descriptionRaw'
  | 'isForeignRemote'
  | 'skillsText'
  | 'publishedAt'
> {
  return {
    source,
    language: Language.Ru,
    externalId: raw.externalId,
    url: raw.url,
    title,
    companyName: normalizeCompanyName(raw.companyName),
    companyDisplayName: raw.companyName.trim(),
    unp: raw.unp,
    region: raw.region,
    city: dictionaryCity(raw.city),
    description,
    descriptionRaw: raw.descriptionHtml,
    isForeignRemote: false,
    skillsText: '',
    publishedAt: raw.publishedAt,
  };
}

function pay(raw: RawVacancy, rates: Record<string, number>) {
  return {
    salaryMin: money(raw.salaryMin),
    salaryMax: money(raw.salaryMax),
    salaryCurrency: raw.salaryCurrency,
    salaryMinByn: toByn(raw.salaryMin, raw.salaryCurrency, rates),
    salaryMaxByn: toByn(raw.salaryMax, raw.salaryCurrency, rates),
    isGross: raw.isGross,
  };
}

function hashOf(
  title: string,
  description: string,
  workFormat: WorkFormat | null,
  schedule: string | null,
): string {
  return contentHash({
    title,
    description,
    skillsText: '',
    conditions: conditionsText(workFormat, schedule),
  });
}

function toByn(
  amount: number | null,
  currency: string | null,
  rates: Record<string, number>,
): string | null {
  if (amount === null || currency === null) return null;
  if (currency === 'BYN') return money(amount);
  const rate = rates[currency];
  if (rate === undefined) return null;
  return money(amount * rate);
}

function money(amount: number | null): string | null {
  if (amount === null) return null;
  return amount.toFixed(2);
}
