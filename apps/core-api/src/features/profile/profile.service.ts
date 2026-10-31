import { Inject, Injectable } from '@nestjs/common';
import {
  ProfileSkillSource,
  ProfileSuggestionKind,
  ProfileSuggestionStatus,
  type ExtractedSuggestion,
  type ParsedResumeExperience,
  type ParsedResumeSkill,
  type ProfileDto,
  type ProfileSkillDto,
  type ProfileSuggestionDto,
} from '@hira/contracts';
import { SKILL_NOT_FOUND_MESSAGE } from '../memory/memory.constants';
import { planAcceptance, type AcceptanceSkill } from './accept-suggestion';
import { chooseSkill } from './choose-skill';
import { PROFILE_STORE, manualSkill, type ProfileStore, type SuggestionRecord } from './profile.store';
import { suggestionPayload } from './suggestion-payload';

export class SkillExistsError extends Error {
  constructor() {
    super('That skill is already on the profile');
    this.name = 'SkillExistsError';
  }
}

/** The skill is not on this account's profile. */
export class SkillMissingError extends Error {
  constructor() {
    super(SKILL_NOT_FOUND_MESSAGE);
    this.name = 'SkillMissingError';
  }
}

export class SuggestionClosedError extends Error {
  constructor() {
    super('Suggestion is no longer pending');
    this.name = 'SuggestionClosedError';
  }
}

/** Profile rows, manual skills, and suggestions that become profile data only on accept. */
@Injectable()
export class ProfileService {
  constructor(@Inject(PROFILE_STORE) private readonly store: ProfileStore) {}

  /** The saved profile, or an empty one when the account has not filled it in. */
  async get(userId: string): Promise<ProfileDto> {
    return (await this.store.get(userId)) ?? empty();
  }

  /** Writes the fields the client sent. */
  save(userId: string, patch: Partial<ProfileDto>): Promise<ProfileDto> {
    return this.store.save(userId, sentFields(patch));
  }

  /** Skills on the profile. */
  skills(userId: string): Promise<ProfileSkillDto[]> {
    return this.store.listSkills(userId);
  }

  /** Adds a self-reported skill. A duplicate id is rejected. */
  async addSkill(userId: string, skillId: number, level: ProfileSkillDto['level'], years: number | null): Promise<ProfileSkillDto> {
    if ((await this.store.findSkill(userId, skillId)) !== null) throw new SkillExistsError();
    await this.store.insertSkill(userId, manualSkill(skillId, level, years, ''));
    const saved = await this.store.findSkill(userId, skillId);
    if (saved === null) throw new SkillMissingError();
    return saved;
  }

  /** Removes a skill. */
  removeSkill(userId: string, skillId: number): Promise<boolean> {
    return this.store.deleteSkill(userId, skillId);
  }

  /** Pending suggestions. */
  async pending(userId: string): Promise<ProfileSuggestionDto[]> {
    const rows = await this.store.listSuggestions(userId, ProfileSuggestionStatus.Pending);
    return rows.map(toDto);
  }

  /** Accepts a pending suggestion into the profile. */
  async accept(userId: string, id: string): Promise<ProfileSuggestionDto> {
    const suggestion = await this.requirePending(userId, id);
    const profile = await this.get(userId);
    const existing = suggestion.payload.skillId === null ? null : await this.store.findSkill(userId, suggestion.payload.skillId);
    const plan = planAcceptance(suggestion, profile, existing);
    if (plan.profile !== null) await this.store.save(userId, plan.profile);
    if (plan.skill !== null && existing === null) await this.store.insertSkill(userId, acceptedSkill(plan.skill, suggestion));
    const saved = await this.store.setSuggestionStatus(userId, id, ProfileSuggestionStatus.Accepted);
    return toDto(saved ?? suggestion);
  }

  /** Dismisses a pending suggestion without touching the profile. */
  async dismiss(userId: string, id: string): Promise<ProfileSuggestionDto> {
    const suggestion = await this.requirePending(userId, id);
    const saved = await this.store.setSuggestionStatus(userId, id, ProfileSuggestionStatus.Dismissed);
    return toDto(saved ?? suggestion);
  }

  /** Turns model suggestions into pending rows. Unresolved skills and cities are skipped. */
  async offerExtracted(
    userId: string,
    items: readonly ExtractedSuggestion[],
    sourceMessageId: string | null,
    sourceCallTurnId: string | null,
  ): Promise<void> {
    for (const item of items) await this.offerOne(userId, item, ProfileSkillSource.ExtractedFromChat, sourceMessageId, null, sourceCallTurnId);
  }

  /** Turns a parsed resume into pending skill and education suggestions. */
  async offerResume(userId: string, documentId: string, skills: readonly ParsedResumeSkill[], experience: readonly ParsedResumeExperience[]): Promise<void> {
    for (const skill of skills) {
      await this.offerOne(userId, skillItem(skill), ProfileSkillSource.ExtractedFromResume, null, documentId, null);
    }
    for (const line of experience) {
      await this.offerOne(userId, educationItem(line.text), ProfileSkillSource.ExtractedFromResume, null, documentId, null);
    }
  }

  private async offerOne(
    userId: string,
    item: ExtractedSuggestion,
    source: ProfileSkillSource,
    sourceMessageId: string | null,
    sourceDocumentId: string | null,
    sourceCallTurnId: string | null,
  ): Promise<void> {
    const skillId = item.kind === ProfileSuggestionKind.Skill && item.surface !== null ? chooseSkill(await this.store.matchSkill(item.surface)) : null;
    const locationId = item.kind === ProfileSuggestionKind.Location && item.city !== null ? await this.store.matchCity(item.city) : null;
    const payload = suggestionPayload(item, skillId, locationId);
    if (payload === null) return;
    await this.store.insertSuggestion({ userId, kind: item.kind, payload, source, sourceMessageId, sourceDocumentId, sourceCallTurnId });
  }

  private async requirePending(userId: string, id: string): Promise<SuggestionRecord> {
    const suggestion = await this.store.findSuggestion(userId, id);
    if (suggestion === null || suggestion.status !== ProfileSuggestionStatus.Pending) throw new SuggestionClosedError();
    return suggestion;
  }
}

function empty(): ProfileDto {
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

function acceptedSkill(skill: AcceptanceSkill, suggestion: SuggestionRecord): ProfileSkillDto {
  return { ...skill, canonicalName: suggestion.payload.surface ?? '' };
}

function toDto(row: SuggestionRecord): ProfileSuggestionDto {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    payload: row.payload,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

function skillItem(skill: ParsedResumeSkill): ExtractedSuggestion {
  return {
    kind: ProfileSuggestionKind.Skill,
    surface: skill.surface,
    level: skill.level,
    years: skill.years,
    workFormat: null,
    employment: null,
    salaryMin: null,
    currency: null,
    city: null,
    role: null,
    education: null,
  };
}

function educationItem(text: string): ExtractedSuggestion {
  return { ...skillItem({ surface: 'x', level: null, years: null }), kind: ProfileSuggestionKind.Education, surface: null, education: text };
}

const LIST_FIELDS: ReadonlySet<string> = new Set(['desiredRoles', 'preferredWorkFormat', 'preferredEmployment', 'preferredLocations']);

/** Drops fields the client did not send. A list column cannot be null, so a null list is not sent either. */
function sentFields(patch: Partial<ProfileDto>): Partial<ProfileDto> {
  const entries = Object.entries(patch).filter(([key, value]) => value !== undefined && !(value === null && LIST_FIELDS.has(key)));
  return Object.fromEntries(entries) as Partial<ProfileDto>;
}
