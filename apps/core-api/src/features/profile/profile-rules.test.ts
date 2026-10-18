import { ProfileSkillSource, ProfileSuggestionKind, SkillLevel, WorkFormat } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { planAcceptance } from './accept-suggestion';
import { chooseSkill } from './choose-skill';
import { emptyPayload, suggestionPayload } from './suggestion-payload';
import type { ProfileDto } from '@hira/contracts';

const profile = emptyProfile();

describe('skill linking', () => {
  it('prefers an exact alias and otherwise the lowest id above the cutoff', () => {
    expect(chooseSkill([{ skillId: 2, exactName: false, exactAlias: true, trigram: 0.4 }])).toBe(2);
    expect(
      chooseSkill([
        { skillId: 5, exactName: false, exactAlias: false, trigram: 0.8 },
        { skillId: 3, exactName: false, exactAlias: false, trigram: 0.8 },
        { skillId: 9, exactName: false, exactAlias: false, trigram: 0.7 },
      ]),
    ).toBe(3);
    expect(chooseSkill([{ skillId: 1, exactName: false, exactAlias: false, trigram: 0.2 }])).toBeNull();
  });
});

describe('suggestion payload', () => {
  it('drops a skill with no graph id and a city that is not in locations', () => {
    const skill = extracted(ProfileSuggestionKind.Skill, { surface: 'Python' });
    expect(suggestionPayload(skill, null, null)).toBeNull();
    expect(suggestionPayload(skill, 4, null)?.skillId).toBe(4);
    const city = extracted(ProfileSuggestionKind.Location, { city: 'Atlantis' });
    expect(suggestionPayload(city, null, null)).toBeNull();
    expect(suggestionPayload(city, null, 7)?.locationId).toBe(7);
  });
});

describe('accept suggestion', () => {
  it('does not overwrite a self-reported skill and appends a work format', () => {
    const skill = {
      kind: ProfileSuggestionKind.Skill,
      source: ProfileSkillSource.ExtractedFromChat,
      payload: { ...emptyPayload(), skillId: 4, level: SkillLevel.Expert, confidence: 0.8 },
    };
    const kept = planAcceptance(skill, profile, { source: ProfileSkillSource.SelfReported });
    expect(kept.keepSelfReported).toBe(true);
    expect(kept.skill).toBeNull();
    const written = planAcceptance(skill, profile, null);
    expect(written.skill).toMatchObject({ skillId: 4, level: SkillLevel.Expert, source: ProfileSkillSource.ExtractedFromChat, confidence: 0.8 });
    const format = planAcceptance(
      {
        kind: ProfileSuggestionKind.WorkFormat,
        source: ProfileSkillSource.ExtractedFromChat,
        payload: { ...emptyPayload(), workFormat: WorkFormat.Remote },
      },
      { ...profile, preferredWorkFormat: [WorkFormat.Remote] },
      null,
    );
    expect(format.profile?.preferredWorkFormat).toEqual([WorkFormat.Remote]);
  });

  it('appends education and fills salary', () => {
    const education = planAcceptance(
      {
        kind: ProfileSuggestionKind.Education,
        source: ProfileSkillSource.ExtractedFromResume,
        payload: { ...emptyPayload(), education: 'BSU' },
      },
      { ...profile, education: 'school' },
      null,
    );
    expect(education.profile?.education).toBe('school\nBSU');
    const salary = planAcceptance(
      {
        kind: ProfileSuggestionKind.Salary,
        source: ProfileSkillSource.ExtractedFromChat,
        payload: { ...emptyPayload(), salaryMin: 2000, currency: 'BYN' },
      },
      profile,
      null,
    );
    expect(salary.profile).toMatchObject({ salaryExpectationMin: 2000, currency: 'BYN' });
  });
});

function extracted(kind: ProfileSuggestionKind, patch: Partial<ReturnType<typeof blankExtracted>>): ReturnType<typeof blankExtracted> {
  return { ...blankExtracted(), kind, ...patch };
}

function blankExtracted() {
  return {
    kind: ProfileSuggestionKind.Skill,
    surface: null,
    level: null,
    years: null,
    workFormat: null,
    employment: null,
    salaryMin: null,
    currency: null,
    city: null,
    role: null,
    education: null,
  };
}

function emptyProfile(): ProfileDto {
  return {
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
}
