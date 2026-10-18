import {
  ProfileSuggestionKind,
  type ExtractedSuggestion,
  type ProfileSuggestionPayload,
} from '@hira/contracts';

/** Builds a payload only when the suggestion can be accepted later. Unresolved skills and cities are dropped. */
export function suggestionPayload(
  item: ExtractedSuggestion,
  skillId: number | null,
  locationId: number | null,
): ProfileSuggestionPayload | null {
  const payload = emptyPayload();
  if (item.kind === ProfileSuggestionKind.Skill) return skillPayload(payload, item, skillId);
  if (item.kind === ProfileSuggestionKind.Location) return locationPayload(payload, locationId);
  return filled(payload, item);
}

function skillPayload(
  payload: ProfileSuggestionPayload,
  item: ExtractedSuggestion,
  skillId: number | null,
): ProfileSuggestionPayload | null {
  if (skillId === null || item.surface === null) return null;
  return { ...payload, skillId, surface: item.surface, level: item.level, years: item.years };
}

function locationPayload(payload: ProfileSuggestionPayload, locationId: number | null): ProfileSuggestionPayload | null {
  if (locationId === null) return null;
  return { ...payload, locationId };
}

function filled(payload: ProfileSuggestionPayload, item: ExtractedSuggestion): ProfileSuggestionPayload | null {
  if (item.kind === ProfileSuggestionKind.WorkFormat && item.workFormat !== null) {
    return { ...payload, workFormat: item.workFormat };
  }
  if (item.kind === ProfileSuggestionKind.Employment && item.employment !== null) {
    return { ...payload, employment: item.employment };
  }
  if (item.kind === ProfileSuggestionKind.Salary && item.salaryMin !== null && item.currency !== null) {
    return { ...payload, salaryMin: item.salaryMin, currency: item.currency };
  }
  if (item.kind === ProfileSuggestionKind.Role && item.role !== null && item.role.trim().length > 0) {
    return { ...payload, role: item.role.trim() };
  }
  if (item.kind === ProfileSuggestionKind.Education && item.education !== null && item.education.trim().length > 0) {
    return { ...payload, education: item.education.trim() };
  }
  return null;
}

/** Stable object so two equal suggestions share one JSON value. */
export function emptyPayload(): ProfileSuggestionPayload {
  return {
    skillId: null,
    surface: null,
    level: null,
    years: null,
    workFormat: null,
    employment: null,
    salaryMin: null,
    currency: null,
    locationId: null,
    role: null,
    education: null,
    confidence: null,
  };
}
