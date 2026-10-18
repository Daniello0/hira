import {
  ProfileSkillSource,
  ProfileSuggestionKind,
  SkillLevel,
  type ProfileDto,
  type ProfileSuggestionPayload,
} from '@hira/contracts';

export interface AcceptanceSkill {
  skillId: number;
  level: SkillLevel;
  years: number | null;
  source: ProfileSkillSource;
  confidence: number;
}

export interface AcceptancePlan {
  skill: AcceptanceSkill | null;
  profile: Partial<ProfileDto> | null;
  keepSelfReported: boolean;
}

export interface ExistingSkill {
  source: ProfileSkillSource;
}

/** What accept writes. A self-reported skill is left untouched. */
export function planAcceptance(
  suggestion: { kind: ProfileSuggestionKind; payload: ProfileSuggestionPayload; source: ProfileSkillSource },
  profile: ProfileDto,
  existing: ExistingSkill | null,
): AcceptancePlan {
  if (suggestion.kind === ProfileSuggestionKind.Skill) return skillPlan(suggestion, existing);
  return { skill: null, profile: profilePlan(suggestion, profile), keepSelfReported: false };
}

function skillPlan(
  suggestion: { payload: ProfileSuggestionPayload; source: ProfileSkillSource },
  existing: ExistingSkill | null,
): AcceptancePlan {
  if (existing?.source === ProfileSkillSource.SelfReported) {
    return { skill: null, profile: null, keepSelfReported: true };
  }
  if (suggestion.payload.skillId === null) return { skill: null, profile: null, keepSelfReported: false };
  return {
    skill: {
      skillId: suggestion.payload.skillId,
      level: suggestion.payload.level ?? SkillLevel.Confident,
      years: suggestion.payload.years,
      source: suggestion.source,
      confidence: suggestion.payload.confidence ?? 1,
    },
    profile: null,
    keepSelfReported: false,
  };
}

function profilePlan(
  suggestion: { kind: ProfileSuggestionKind; payload: ProfileSuggestionPayload },
  profile: ProfileDto,
): Partial<ProfileDto> | null {
  const payload = suggestion.payload;
  if (suggestion.kind === ProfileSuggestionKind.WorkFormat && payload.workFormat !== null) {
    return { preferredWorkFormat: append(profile.preferredWorkFormat, payload.workFormat) };
  }
  if (suggestion.kind === ProfileSuggestionKind.Employment && payload.employment !== null) {
    return { preferredEmployment: append(profile.preferredEmployment, payload.employment) };
  }
  if (suggestion.kind === ProfileSuggestionKind.Role && payload.role !== null) {
    return { desiredRoles: append(profile.desiredRoles, payload.role) };
  }
  if (suggestion.kind === ProfileSuggestionKind.Location && payload.locationId !== null) {
    return { preferredLocations: append(profile.preferredLocations, payload.locationId) };
  }
  if (suggestion.kind === ProfileSuggestionKind.Salary && payload.salaryMin !== null) {
    return { salaryExpectationMin: payload.salaryMin, currency: payload.currency };
  }
  if (suggestion.kind === ProfileSuggestionKind.Education && payload.education !== null) {
    return { education: appendText(profile.education, payload.education) };
  }
  return null;
}

function append<T>(values: readonly T[], value: T): T[] {
  if (values.includes(value)) return [...values];
  return [...values, value];
}

function appendText(current: string | null, extra: string): string {
  if (current === null || current.trim().length === 0) return extra;
  return `${current}\n${extra}`;
}
