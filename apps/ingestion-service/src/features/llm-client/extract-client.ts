import {
  SkillImportance,
  SkillType,
  type ExtractedSkill,
  type ExtractSkillsVacancy,
} from '@hira/contracts';
import { isRecord } from '../connectors/record';

export interface ExtractHttp {
  post(url: string, token: string, body: unknown): Promise<{ status: number; body: unknown }>;
}

/** A non-200 answer of llm-service; `status` 429 means the free key is rate limited. */
export class ExtractHttpError extends Error {
  constructor(
    readonly status: number,
    code: string,
  ) {
    super(code);
  }
}

/** Skills per vacancy id, or the reason that vacancy's answer was unusable. */
export type ExtractBatchResult = Map<string, ExtractedSkill[] | Error>;

/** Asks llm-service for skills of one vacancy. A non-200 status throws. */
export async function requestExtractedSkills(
  http: ExtractHttp,
  baseUrl: string,
  token: string,
  vacancy: ExtractSkillsVacancy,
): Promise<ExtractedSkill[]> {
  const result = (await requestExtractedSkillsBatch(http, baseUrl, token, [vacancy])).get(
    vacancy.id,
  );
  if (result === undefined || result instanceof Error) {
    throw result ?? new Error('invalid extract-skills response');
  }
  return result;
}

/**
 * One extract-skills call for several vacancies (one model call on llm-service).
 * A non-200 status throws `ExtractHttpError`; a bad entry fails only its own vacancy.
 */
export async function requestExtractedSkillsBatch(
  http: ExtractHttp,
  baseUrl: string,
  token: string,
  vacancies: readonly ExtractSkillsVacancy[],
): Promise<ExtractBatchResult> {
  const response = await http.post(endpoint(baseUrl), token, { vacancies });
  if (response.status !== 200) {
    throw new ExtractHttpError(response.status, errorCode(response.body));
  }
  if (!isRecord(response.body) || !Array.isArray(response.body.results)) {
    throw new Error('invalid extract-skills response');
  }
  const rows = response.body.results;
  return new Map(vacancies.map((vacancy) => [vacancy.id, readOne(rows, vacancy.id)]));
}

function readOne(rows: unknown[], id: string): ExtractedSkill[] | Error {
  try {
    return readSkills(rows, id);
  } catch (error) {
    return error instanceof Error ? error : new Error('invalid extract-skills response');
  }
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/internal/v1/extract-skills`;
}

function errorCode(body: unknown): string {
  if (isRecord(body) && typeof body.errorCode === 'string') return body.errorCode;
  return 'extract-skills failed';
}

function readSkills(rows: unknown[], id: string): ExtractedSkill[] {
  const row = rows.find((item) => isRecord(item) && item.id === id);
  if (!isRecord(row) || !Array.isArray(row.skills))
    throw new Error('invalid extract-skills response');
  return row.skills.map(readSkill);
}

function readSkill(value: unknown): ExtractedSkill {
  if (!isRecord(value)) throw new Error('invalid extracted skill');
  const skillType = enumValue(SkillType, value.skillType);
  const importance = enumValue(SkillImportance, value.importance);
  if (typeof value.surface !== 'string' || skillType === null || importance === null) {
    throw new Error('invalid extracted skill');
  }
  if (!isWeight(value.weight) || !isSpan(value.evidenceSpan))
    throw new Error('invalid extracted skill');
  return {
    surface: value.surface,
    skillType,
    importance,
    evidenceSpan: value.evidenceSpan,
    weight: value.weight,
  };
}

function enumValue<T extends Record<string, string>>(enu: T, value: unknown): T[keyof T] | null {
  if (typeof value !== 'string') return null;
  return (Object.values(enu) as string[]).includes(value) ? (value as T[keyof T]) : null;
}

function isWeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isSpan(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
