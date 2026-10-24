import type { RateUnit } from '@hira/contracts';

/** A posting as a connector saw it, before canonical columns. */
export interface RawVacancy {
  externalId: string;
  url: string | null;
  title: string;
  companyName: string;
  unp: string | null;
  region: string | null;
  city: string | null;
  descriptionHtml: string;
  seniorityRaw: string | null;
  employmentRaw: string | null;
  workFormatRaw: string | null;
  schedule: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  isGross: boolean | null;
  publishedAt: string | null;
  archived: boolean;
  /** ISO 3166 alpha-2 or an English country name; absent for Belarusian sources. */
  country?: string | null;
  /** True when the card came from a "remote, worldwide" list query. */
  remoteWorldwide?: boolean;
  /** Pay phrase as printed ("$40/hr", "2 000 руб."), parsed for freelance rates. */
  payText?: string | null;
  /** Freelance rate the source states in structured form. */
  rateAmount?: number | null;
  rateUnit?: RateUnit | null;
}

/** One row in a source list, before the detail page is fetched. */
export interface RawVacancyRef {
  externalId: string;
  /** City printed on the list card, used when the detail page has none. */
  city?: string | null;
  /** Set by the remote-worldwide list query of LinkedIn and Indeed. */
  remoteWorldwide?: boolean;
}
