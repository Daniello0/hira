import type { CatalogStats } from '../catalog/catalog-stats.dto';
import type { PromptMemory } from './understand.dto';

/** One vacancy as Hira may speak about it. `source` is the site name. */
export interface PromptVacancy {
  title: string;
  company: string;
  city: string | null;
  source: string | null;
  workFormat: string | null;
}

/** What the account filled in about itself. */
export interface PromptProfile {
  name: string | null;
  headline: string | null;
  about: string | null;
  seniority: string | null;
  desiredRoles: string[];
  workFormats: string[];
  salaryMin: number | null;
  currency: string | null;
  education: string | null;
  skills: string[];
}

/** One earlier chat or call. */
export interface PromptActivity {
  kind: 'chat' | 'call';
  title: string | null;
  summary: string | null;
  queries: string[];
  vacancies: PromptVacancy[];
}

/** True data about the catalog and the caller, sent beside the prompt of a reply. */
export interface TurnFacts {
  catalog: CatalogStats | null;
  profile: PromptProfile | null;
  memory: PromptMemory[];
  favorites: PromptVacancy[];
  /** Newest first. */
  activity: PromptActivity[];
  /** Vacancies shown earlier in this conversation, newest search first, in the order shown. */
  shownHere: PromptVacancy[];
}
