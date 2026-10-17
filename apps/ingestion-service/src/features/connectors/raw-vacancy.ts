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
}

/** One row in a source list, before the detail page is fetched. */
export interface RawVacancyRef {
  externalId: string;
}
