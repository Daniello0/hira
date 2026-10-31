import type { VacancySource } from '../../enums/vacancy-source.enum';

/** Live vacancies in the catalog, for answering "how many". */
export interface CatalogStats {
  total: number;
  byRegion: { region: string; count: number }[];
  /** The most common cities, largest first. */
  topCities: { city: string; count: number }[];
  noLocation: number;
  remote: number;
  foreignRemote: number;
  bySource: { source: VacancySource; count: number }[];
}
