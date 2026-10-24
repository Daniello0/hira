import type { SkillImportance } from '../../enums/skill-importance.enum';
import type { VacancyDto } from './vacancy.dto';

/** One skill a vacancy asks for, with the sentence it came from. */
export interface VacancySkillDto {
  skillId: number;
  name: string;
  importance: SkillImportance;
  evidenceSpan: string | null;
}

/** Body of `GET /api/v1/vacancies/{id}`. */
export interface VacancyDetailDto extends VacancyDto {
  skills: VacancySkillDto[];
}

/** A missing skill and the owned skills that lead to it through the graph. */
export interface SkillGapItem {
  skillId: number;
  name: string;
  importance: SkillImportance;
  /** Profile skills one or two graph hops away. Empty when nothing related is owned. */
  relatedOwned: string[];
}

/** Body of `GET /api/v1/vacancies/{id}/skill-gap` (US-6). */
export interface SkillGapDto {
  vacancyId: string;
  matched: VacancySkillDto[];
  missing: SkillGapItem[];
  /** Share of required and preferred skills the profile covers, 0..1. */
  coverage: number;
}

/** Body of `GET /api/v1/vacancies/{id}/similar`. */
export interface SimilarVacanciesDto {
  items: VacancyDto[];
}
