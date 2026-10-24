import { describe, expect, it } from 'vitest';
import { ProfileSuggestionKind, type ProfileSuggestionDto, type ProfileSuggestionPayload } from '@hira/contracts';
import { suggestionCanAccept, suggestionTitle } from './format-suggestion';

describe('format suggestion', () => {
  it('names a skill, a salary, and education differently', () => {
    expect(suggestionTitle(suggestion(ProfileSuggestionKind.Skill, { surface: 'Python' }))).toBe('Add Python to your profile?');
    expect(suggestionTitle(suggestion(ProfileSuggestionKind.Salary, {}))).toBe('Add a salary preference to your profile?');
    expect(suggestionTitle(suggestion(ProfileSuggestionKind.Education, {}))).toBe('Add education to your profile?');
  });

  it('refuses a skill that the catalog did not match', () => {
    expect(suggestionCanAccept(suggestion(ProfileSuggestionKind.Skill, { surface: 'Python', skillId: null }))).toBe(false);
    expect(suggestionCanAccept(suggestion(ProfileSuggestionKind.Skill, { skillId: 4 }))).toBe(true);
    expect(suggestionCanAccept(suggestion(ProfileSuggestionKind.Education, {}))).toBe(true);
  });
});

function suggestion(kind: ProfileSuggestionKind, payload: Partial<ProfileSuggestionPayload>): ProfileSuggestionDto {
  return {
    id: 'suggestion',
    kind,
    status: 'PENDING' as ProfileSuggestionDto['status'],
    source: 'EXTRACTED_FROM_CHAT' as ProfileSuggestionDto['source'],
    createdAt: '2026-10-24T00:00:00.000Z',
    payload: {
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
      confidence: 0.8,
      ...payload,
    },
  };
}
