import { ProfileSuggestionKind, type ProfileSuggestionDto } from '@hira/contracts';

export const SKILL_NOT_IN_CATALOG = 'This skill is not in the catalog yet.';

/** Modal title. A skill uses the surface the model extracted. */
export function suggestionTitle(suggestion: ProfileSuggestionDto): string {
  if (suggestion.kind === ProfileSuggestionKind.Skill) return `Add ${label(suggestion.payload.surface, 'this skill')} to your profile?`;
  if (suggestion.kind === ProfileSuggestionKind.Salary) return 'Add a salary preference to your profile?';
  if (suggestion.kind === ProfileSuggestionKind.Education) return 'Add education to your profile?';
  if (suggestion.kind === ProfileSuggestionKind.Role) return `Add ${label(suggestion.payload.role, 'this role')} to your profile?`;
  if (suggestion.kind === ProfileSuggestionKind.WorkFormat) return 'Add a work format to your profile?';
  if (suggestion.kind === ProfileSuggestionKind.Employment) return 'Add an employment preference to your profile?';
  return 'Add a location preference to your profile?';
}

/** A skill with no catalog id cannot be written onto the profile. */
export function suggestionCanAccept(suggestion: ProfileSuggestionDto): boolean {
  if (suggestion.kind !== ProfileSuggestionKind.Skill) return true;
  return suggestion.payload.skillId !== null;
}

function label(value: string | null, fallback: string): string {
  if (value === null || value.trim().length === 0) return fallback;
  return value.trim();
}
