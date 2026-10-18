import type { EmploymentType } from '../../enums/employment-type.enum';
import type { ProfileSkillSource } from '../../enums/profile-skill-source.enum';
import type { ProfileSuggestionKind } from '../../enums/profile-suggestion-kind.enum';
import type { ProfileSuggestionStatus } from '../../enums/profile-suggestion-status.enum';
import type { SeniorityLevel } from '../../enums/seniority-level.enum';
import type { SkillLevel } from '../../enums/skill-level.enum';
import type { WorkFormat } from '../../enums/work-format.enum';

/** Seeker profile. The embedding used for personalization stays empty in this stage. */
export interface ProfileDto {
  headline: string | null;
  about: string | null;
  seniority: SeniorityLevel | null;
  desiredRoles: string[];
  preferredWorkFormat: WorkFormat[];
  preferredEmployment: EmploymentType[];
  preferredLocations: number[];
  salaryExpectationMin: number | null;
  currency: string | null;
  education: string | null;
}

/** Fields accepted by `PUT /api/v1/profile`. Omitted fields stay as they are. */
export type UpdateProfileRequest = Partial<ProfileDto>;

/** One skill on the profile. */
export interface ProfileSkillDto {
  skillId: number;
  /** `skills.canonical_name`. The chat panel shows this, not the numeric id. */
  canonicalName: string;
  level: SkillLevel;
  years: number | null;
  source: ProfileSkillSource;
  confidence: number;
}

/** Body of `POST /api/v1/profile/skills`. */
export interface CreateProfileSkillRequest {
  skillId: number;
  level: SkillLevel;
  years?: number | null;
}

/** Stored suggestion payload. Unused fields are null so two payloads compare cleanly. */
export interface ProfileSuggestionPayload {
  skillId: number | null;
  surface: string | null;
  level: SkillLevel | null;
  years: number | null;
  workFormat: WorkFormat | null;
  employment: EmploymentType | null;
  salaryMin: number | null;
  currency: string | null;
  locationId: number | null;
  role: string | null;
  education: string | null;
  confidence: number | null;
}

/** One pending or settled suggestion. */
export interface ProfileSuggestionDto {
  id: string;
  kind: ProfileSuggestionKind;
  status: ProfileSuggestionStatus;
  payload: ProfileSuggestionPayload;
  source: ProfileSkillSource;
  createdAt: string;
}
