import { ProfileSuggestionKind, type ProfileSuggestionDto, type ProfileSuggestionPayload } from '@hira/contracts';
import { employmentLabel, skillLevelLabel, workFormatLabel } from '../../common/utils/enum-labels';
import { SKILL_NOT_IN_CATALOG } from './suggestions.constants';

export { SKILL_NOT_IN_CATALOG };

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

/** The value that would be written, e.g. "Python · Confident · 2 years". `null` when there is nothing to show. */
export function suggestionValue(suggestion: ProfileSuggestionDto): string | null {
  const payload = suggestion.payload;
  if (suggestion.kind === ProfileSuggestionKind.Skill) return skillValue(payload);
  if (suggestion.kind === ProfileSuggestionKind.Salary) return salaryValue(payload);
  if (suggestion.kind === ProfileSuggestionKind.Education) return blankToNull(payload.education);
  if (suggestion.kind === ProfileSuggestionKind.Role) return blankToNull(payload.role);
  if (suggestion.kind === ProfileSuggestionKind.WorkFormat) return payload.workFormat === null ? null : workFormatLabel(payload.workFormat);
  if (suggestion.kind === ProfileSuggestionKind.Employment) return payload.employment === null ? null : employmentLabel(payload.employment);
  return blankToNull(payload.surface) ?? (payload.locationId === null ? null : `Location #${payload.locationId}`);
}

/** A skill with no catalog id cannot be written onto the profile. */
export function suggestionCanAccept(suggestion: ProfileSuggestionDto): boolean {
  if (suggestion.kind !== ProfileSuggestionKind.Skill) return true;
  return suggestion.payload.skillId !== null;
}

function skillValue(payload: ProfileSuggestionPayload): string | null {
  const name = blankToNull(payload.surface);
  if (name === null) return null;
  const parts = [name];
  if (payload.level !== null) parts.push(skillLevelLabel(payload.level));
  if (payload.years !== null) parts.push(`${payload.years} ${payload.years === 1 ? 'year' : 'years'}`);
  return parts.join(' · ');
}

function salaryValue(payload: ProfileSuggestionPayload): string | null {
  if (payload.salaryMin === null) return null;
  return `From ${payload.salaryMin.toLocaleString('en-US')} ${payload.currency ?? ''}`.trim();
}

function label(value: string | null, fallback: string): string {
  return blankToNull(value) ?? fallback;
}

function blankToNull(value: string | null): string | null {
  if (value === null || value.trim().length === 0) return null;
  return value.trim();
}
