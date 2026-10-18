import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ProfileSuggestionStatus } from '@hira/contracts';
import type { SkillHit } from './choose-skill';
import {
  EMPTY_PROFILE,
  type NewSuggestion,
  type ProfileStore,
  type SuggestionRecord,
} from './profile.store';
import type { ProfileDto, ProfileSkillDto } from '@hira/contracts';

/** Process-local profile, skills, and suggestions. */
@Injectable()
export class MemoryProfileStore implements ProfileStore {
  readonly profiles = new Map<string, ProfileDto>();
  readonly skills: Array<ProfileSkillDto & { userId: string }> = [];
  readonly suggestions: SuggestionRecord[] = [];
  readonly skillHits = new Map<string, SkillHit[]>();
  readonly cities = new Map<string, number>();

  /** @inheritdoc */
  async get(userId: string): Promise<ProfileDto | null> {
    const profile = this.profiles.get(userId);
    return profile === undefined ? null : { ...profile, desiredRoles: [...profile.desiredRoles] };
  }

  /** @inheritdoc */
  async save(userId: string, patch: Partial<ProfileDto>): Promise<ProfileDto> {
    const current = (await this.get(userId)) ?? { ...EMPTY_PROFILE, desiredRoles: [], preferredWorkFormat: [], preferredEmployment: [], preferredLocations: [] };
    const next = { ...current, ...patch };
    this.profiles.set(userId, next);
    return next;
  }

  /** @inheritdoc */
  async listSkills(userId: string): Promise<ProfileSkillDto[]> {
    return this.skills.filter((skill) => skill.userId === userId).map(stripUser);
  }

  /** @inheritdoc */
  async findSkill(userId: string, skillId: number): Promise<ProfileSkillDto | null> {
    const skill = this.skills.find((item) => item.userId === userId && item.skillId === skillId);
    return skill === undefined ? null : stripUser(skill);
  }

  /** @inheritdoc */
  async insertSkill(userId: string, skill: ProfileSkillDto): Promise<ProfileSkillDto> {
    this.skills.push({ ...skill, userId });
    return skill;
  }

  /** @inheritdoc */
  async deleteSkill(userId: string, skillId: number): Promise<boolean> {
    const index = this.skills.findIndex((skill) => skill.userId === userId && skill.skillId === skillId);
    if (index < 0) return false;
    this.skills.splice(index, 1);
    return true;
  }

  /** @inheritdoc */
  async listSuggestions(userId: string, status: ProfileSuggestionStatus): Promise<SuggestionRecord[]> {
    return this.suggestions.filter((item) => item.userId === userId && item.status === status);
  }

  /** @inheritdoc */
  async findSuggestion(userId: string, id: string): Promise<SuggestionRecord | null> {
    return this.suggestions.find((item) => item.userId === userId && item.id === id) ?? null;
  }

  /** @inheritdoc */
  async insertSuggestion(input: NewSuggestion): Promise<SuggestionRecord | null> {
    const duplicate = this.suggestions.find((item) => samePending(item, input));
    if (duplicate !== undefined) return null;
    const record: SuggestionRecord = { ...input, id: randomUUID(), status: ProfileSuggestionStatus.Pending, createdAt: new Date() };
    this.suggestions.push(record);
    return record;
  }

  /** @inheritdoc */
  async setSuggestionStatus(userId: string, id: string, status: ProfileSuggestionStatus): Promise<SuggestionRecord | null> {
    const suggestion = await this.findSuggestion(userId, id);
    if (suggestion === null) return null;
    suggestion.status = status;
    return suggestion;
  }

  /** @inheritdoc */
  async matchSkill(surface: string): Promise<SkillHit[]> {
    return this.skillHits.get(surface.trim().toLowerCase()) ?? [];
  }

  /** @inheritdoc */
  async matchCity(city: string): Promise<number | null> {
    return this.cities.get(city.trim().toLowerCase()) ?? null;
  }
}

function stripUser(skill: ProfileSkillDto & { userId: string }): ProfileSkillDto {
  return { skillId: skill.skillId, level: skill.level, years: skill.years, source: skill.source, confidence: skill.confidence };
}

function samePending(item: SuggestionRecord, input: NewSuggestion): boolean {
  return item.userId === input.userId && item.status === ProfileSuggestionStatus.Pending && item.kind === input.kind && JSON.stringify(item.payload) === JSON.stringify(input.payload);
}
