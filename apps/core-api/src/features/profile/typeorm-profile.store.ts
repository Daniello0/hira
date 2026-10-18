import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  EmploymentType,
  ProfileSkillSource,
  ProfileSuggestionKind,
  ProfileSuggestionStatus,
  SeniorityLevel,
  SkillLevel,
  WorkFormat,
  type ProfileDto,
  type ProfileSkillDto,
  type ProfileSuggestionPayload,
} from '@hira/contracts';
import { DataSource } from 'typeorm';
import { TRIGRAM_MATCH_THRESHOLD } from '../memory/memory.constants';
import type { SkillHit } from './choose-skill';
import { EMPTY_PROFILE, type NewSuggestion, type ProfileStore, type SuggestionRecord } from './profile.store';

/** PostgreSQL profile, skills, and suggestions. */
@Injectable()
export class TypeOrmProfileStore implements ProfileStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** @inheritdoc */
  async get(userId: string): Promise<ProfileDto | null> {
    const rows = await this.query(`SELECT * FROM user_profiles WHERE user_id = $1`, [userId]);
    return rows[0] === undefined ? null : profileOf(rows[0]);
  }

  /** @inheritdoc */
  async save(userId: string, patch: Partial<ProfileDto>): Promise<ProfileDto> {
    const current = (await this.get(userId)) ?? { ...EMPTY_PROFILE };
    const next = { ...current, ...patch };
    await this.query(
      `INSERT INTO user_profiles (
        user_id, headline, about, seniority, desired_roles, preferred_work_format, preferred_employment,
        preferred_locations, salary_expectation_min, currency, education
      ) VALUES ($1,$2,$3,$4,$5,$6::work_format[],$7::employment_type[],$8,$9,$10,$11)
      ON CONFLICT (user_id) DO UPDATE SET
        headline = EXCLUDED.headline, about = EXCLUDED.about, seniority = EXCLUDED.seniority,
        desired_roles = EXCLUDED.desired_roles, preferred_work_format = EXCLUDED.preferred_work_format,
        preferred_employment = EXCLUDED.preferred_employment, preferred_locations = EXCLUDED.preferred_locations,
        salary_expectation_min = EXCLUDED.salary_expectation_min, currency = EXCLUDED.currency, education = EXCLUDED.education`,
      [
        userId,
        next.headline,
        next.about,
        next.seniority,
        next.desiredRoles,
        next.preferredWorkFormat,
        next.preferredEmployment,
        next.preferredLocations,
        next.salaryExpectationMin,
        next.currency,
        next.education,
      ],
    );
    return next;
  }

  /** @inheritdoc */
  async listSkills(userId: string): Promise<ProfileSkillDto[]> {
    const rows = await this.query(
      `SELECT skill_id AS "skillId", level::text AS level, years, source::text AS source, confidence
       FROM user_profile_skills WHERE user_id = $1`,
      [userId],
    );
    return rows.map(skillOf);
  }

  /** @inheritdoc */
  async findSkill(userId: string, skillId: number): Promise<ProfileSkillDto | null> {
    const skills = await this.listSkills(userId);
    return skills.find((skill) => skill.skillId === skillId) ?? null;
  }

  /** @inheritdoc */
  async insertSkill(userId: string, skill: ProfileSkillDto): Promise<ProfileSkillDto> {
    await this.query(
      `INSERT INTO user_profile_skills (user_id, skill_id, level, years, source, confidence) VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, skill.skillId, skill.level, skill.years, skill.source, skill.confidence],
    );
    return skill;
  }

  /** @inheritdoc */
  async deleteSkill(userId: string, skillId: number): Promise<boolean> {
    const rows = await this.query(`DELETE FROM user_profile_skills WHERE user_id = $1 AND skill_id = $2 RETURNING skill_id`, [userId, skillId]);
    return rows.length > 0;
  }

  /** @inheritdoc */
  async listSuggestions(userId: string, status: ProfileSuggestionStatus): Promise<SuggestionRecord[]> {
    const rows = await this.query(
      `SELECT id, user_id AS "userId", kind::text AS kind, status::text AS status, payload, source::text AS source,
        source_message_id AS "sourceMessageId", source_document_id AS "sourceDocumentId",
        source_call_turn_id AS "sourceCallTurnId", created_at AS "createdAt"
       FROM profile_suggestions WHERE user_id = $1 AND status = $2`,
      [userId, status],
    );
    return rows.map(suggestionOf);
  }

  /** @inheritdoc */
  async findSuggestion(userId: string, id: string): Promise<SuggestionRecord | null> {
    const rows = await this.listSuggestions(userId, ProfileSuggestionStatus.Pending);
    const pending = rows.find((item) => item.id === id);
    if (pending !== undefined) return pending;
    const all = await this.query(
      `SELECT id, user_id AS "userId", kind::text AS kind, status::text AS status, payload, source::text AS source,
        source_message_id AS "sourceMessageId", source_document_id AS "sourceDocumentId",
        source_call_turn_id AS "sourceCallTurnId", created_at AS "createdAt"
       FROM profile_suggestions WHERE user_id = $1 AND id = $2`,
      [userId, id],
    );
    return all[0] === undefined ? null : suggestionOf(all[0]);
  }

  /** @inheritdoc */
  async insertSuggestion(input: NewSuggestion): Promise<SuggestionRecord | null> {
    try {
      const rows = await this.query(
        `INSERT INTO profile_suggestions (id, user_id, kind, status, payload, source, source_message_id, source_document_id, source_call_turn_id)
         VALUES ($1,$2,$3,'PENDING',$4::jsonb,$5,$6,$7,$8)
         RETURNING id, user_id AS "userId", kind::text AS kind, status::text AS status, payload, source::text AS source,
           source_message_id AS "sourceMessageId", source_document_id AS "sourceDocumentId",
           source_call_turn_id AS "sourceCallTurnId", created_at AS "createdAt"`,
        [randomUUID(), input.userId, input.kind, JSON.stringify(input.payload), input.source, input.sourceMessageId, input.sourceDocumentId, input.sourceCallTurnId],
      );
      return suggestionOf(rows[0]);
    } catch (error) {
      if (isUnique(error)) return null;
      throw error;
    }
  }

  /** @inheritdoc */
  async setSuggestionStatus(userId: string, id: string, status: ProfileSuggestionStatus): Promise<SuggestionRecord | null> {
    const rows = await this.query(
      `UPDATE profile_suggestions SET status = $3 WHERE id = $1 AND user_id = $2
       RETURNING id, user_id AS "userId", kind::text AS kind, status::text AS status, payload, source::text AS source,
         source_message_id AS "sourceMessageId", source_document_id AS "sourceDocumentId",
         source_call_turn_id AS "sourceCallTurnId", created_at AS "createdAt"`,
      [id, userId, status],
    );
    return rows[0] === undefined ? null : suggestionOf(rows[0]);
  }

  /** @inheritdoc */
  async matchSkill(surface: string): Promise<SkillHit[]> {
    const rows = await this.query(
      `SELECT s.id AS "skillId",
        lower(trim(s.canonical_name)) = lower(trim($1)) AS "exactName",
        EXISTS (SELECT 1 FROM skill_aliases a WHERE a.skill_id = s.id AND lower(trim(a.alias)) = lower(trim($1))) AS "exactAlias",
        GREATEST(similarity(s.canonical_name, $1), COALESCE((SELECT MAX(similarity(a.alias, $1)) FROM skill_aliases a WHERE a.skill_id = s.id), 0)) AS trigram
       FROM skills s
       WHERE lower(trim(s.canonical_name)) = lower(trim($1))
          OR EXISTS (SELECT 1 FROM skill_aliases a WHERE a.skill_id = s.id AND lower(trim(a.alias)) = lower(trim($1)))
          OR similarity(s.canonical_name, $1) >= $2
       ORDER BY s.id
       LIMIT 20`,
      [surface, TRIGRAM_MATCH_THRESHOLD],
    );
    return rows.map((row) => ({
      skillId: Number(row.skillId),
      exactName: row.exactName === true,
      exactAlias: row.exactAlias === true,
      trigram: Number(row.trigram),
    }));
  }

  /** @inheritdoc */
  async matchCity(city: string): Promise<number | null> {
    const rows = await this.query(`SELECT id FROM locations WHERE lower(city) = lower($1) ORDER BY id LIMIT 1`, [city]);
    return rows[0] === undefined ? null : Number(rows[0].id);
  }

  private async query(statement: string, params: unknown[]): Promise<Record<string, unknown>[]> {
    const rows = await this.dataSource.query(statement, params);
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  }
}

function profileOf(row: Record<string, unknown>): ProfileDto {
  return {
    headline: textOrNull(row.headline),
    about: textOrNull(row.about),
    seniority: row.seniority === null || row.seniority === undefined ? null : (String(row.seniority) as SeniorityLevel),
    desiredRoles: arrayOf(row.desired_roles),
    preferredWorkFormat: arrayOf(row.preferred_work_format) as WorkFormat[],
    preferredEmployment: arrayOf(row.preferred_employment) as EmploymentType[],
    preferredLocations: arrayOf(row.preferred_locations).map(Number),
    salaryExpectationMin: row.salary_expectation_min === null || row.salary_expectation_min === undefined ? null : Number(row.salary_expectation_min),
    currency: textOrNull(row.currency),
    education: textOrNull(row.education),
  };
}

function skillOf(row: Record<string, unknown>): ProfileSkillDto {
  return {
    skillId: Number(row.skillId),
    level: String(row.level) as SkillLevel,
    years: row.years === null || row.years === undefined ? null : Number(row.years),
    source: String(row.source) as ProfileSkillSource,
    confidence: Number(row.confidence),
  };
}

function suggestionOf(row: Record<string, unknown> | undefined): SuggestionRecord {
  if (row === undefined) throw new Error('suggestion row is missing');
  return {
    id: String(row.id),
    userId: String(row.userId),
    kind: String(row.kind) as ProfileSuggestionKind,
    status: String(row.status) as ProfileSuggestionStatus,
    payload: row.payload as ProfileSuggestionPayload,
    source: String(row.source) as ProfileSkillSource,
    sourceMessageId: textOrNull(row.sourceMessageId),
    sourceDocumentId: textOrNull(row.sourceDocumentId),
    sourceCallTurnId: textOrNull(row.sourceCallTurnId),
    createdAt: new Date(row.createdAt as string),
  };
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function arrayOf(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function isUnique(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const row = error as { code?: string };
  return row.code === '23505';
}
