import type { SkillLevel } from '../../enums/skill-level.enum';

/** One skill line from a resume. An unknown level stays null. */
export interface ParsedResumeSkill {
  surface: string;
  level: SkillLevel | null;
  years: number | null;
}

/** One experience line. Core-api may offer it as education text. */
export interface ParsedResumeExperience {
  text: string;
}

/** Body of `POST /internal/v1/parse-resume`. The file itself never leaves core-api. */
export interface ParseResumeRequest {
  resumeText: string;
}

/** Skills and experience extracted from resume text. */
export interface ParseResumeResponse {
  skills: ParsedResumeSkill[];
  experience: ParsedResumeExperience[];
}
