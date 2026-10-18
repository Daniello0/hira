import type {
  ProfileDto,
  ProfileSkillDto,
  ProfileSuggestionKind,
  ProfileSuggestionPayload,
  ProfileSuggestionStatus,
  SkillLevel,
} from '@hira/contracts';
import { ProfileSkillSource } from '@hira/contracts';
import type { SkillHit } from './choose-skill';

export const PROFILE_STORE = Symbol('PROFILE_STORE');

export interface SuggestionRecord {
  id: string;
  userId: string;
  kind: ProfileSuggestionKind;
  status: ProfileSuggestionStatus;
  payload: ProfileSuggestionPayload;
  source: ProfileSkillSource;
  sourceMessageId: string | null;
  sourceDocumentId: string | null;
  sourceCallTurnId: string | null;
  createdAt: Date;
}

export interface NewSuggestion {
  userId: string;
  kind: ProfileSuggestionKind;
  payload: ProfileSuggestionPayload;
  source: ProfileSkillSource;
  sourceMessageId: string | null;
  sourceDocumentId: string | null;
  sourceCallTurnId: string | null;
}

export interface ProfileStore {
  get(userId: string): Promise<ProfileDto | null>;
  save(userId: string, patch: Partial<ProfileDto>): Promise<ProfileDto>;
  listSkills(userId: string): Promise<ProfileSkillDto[]>;
  findSkill(userId: string, skillId: number): Promise<ProfileSkillDto | null>;
  insertSkill(userId: string, skill: ProfileSkillDto): Promise<ProfileSkillDto>;
  deleteSkill(userId: string, skillId: number): Promise<boolean>;
  listSuggestions(userId: string, status: ProfileSuggestionStatus): Promise<SuggestionRecord[]>;
  findSuggestion(userId: string, id: string): Promise<SuggestionRecord | null>;
  insertSuggestion(input: NewSuggestion): Promise<SuggestionRecord | null>;
  setSuggestionStatus(userId: string, id: string, status: ProfileSuggestionStatus): Promise<SuggestionRecord | null>;
  matchSkill(surface: string): Promise<SkillHit[]>;
  matchCity(city: string): Promise<number | null>;
}

export const EMPTY_PROFILE: ProfileDto = {
  headline: null,
  about: null,
  seniority: null,
  desiredRoles: [],
  preferredWorkFormat: [],
  preferredEmployment: [],
  preferredLocations: [],
  salaryExpectationMin: null,
  currency: null,
  education: null,
};

/** Manual skills are confident claims. */
export function manualSkill(skillId: number, level: SkillLevel, years: number | null): ProfileSkillDto {
  return { skillId, level, years, source: ProfileSkillSource.SelfReported, confidence: 1 };
}
