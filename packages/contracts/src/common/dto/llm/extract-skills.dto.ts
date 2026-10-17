import type { SkillImportance } from '../../enums/skill-importance.enum';
import type { SkillType } from '../../enums/skill-type.enum';

/** One vacancy sent to `POST /internal/v1/extract-skills`. */
export interface ExtractSkillsVacancy {
  id: string;
  title: string;
  description: string;
}

/** Body of `POST /internal/v1/extract-skills`. Shape follows Wiki/05-api-contracts.md. */
export interface ExtractSkillsRequest {
  vacancies: ExtractSkillsVacancy[];
}

/** One skill the model copied out of a vacancy description. */
export interface ExtractedSkill {
  surface: string;
  skillType: SkillType;
  importance: SkillImportance;
  evidenceSpan: string | null;
  weight: number;
}

/** Skills extracted for one vacancy id. */
export interface ExtractedSkills {
  id: string;
  skills: ExtractedSkill[];
}

/** Response of `POST /internal/v1/extract-skills`. */
export interface ExtractSkillsResponse {
  results: ExtractedSkills[];
}
