import type {
  ExtractedSkill,
  ExtractedSkills,
  ExtractSkillsRequest,
  ExtractSkillsResponse,
  ExtractSkillsVacancy,
  TokenUsage,
} from '@hira/contracts';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { readPromptCache, writePromptCache, type PromptCache } from '../cache/prompt-cache';
import { extractSkillsCacheKey } from '../cache/extract-skills-cache-key';
import { LlmOutputError } from '../llm/llm.errors';
import {
  BACKGROUND_ATTEMPT_TIMEOUT_MS,
  BACKGROUND_BUDGET_MS,
  EXTRACT_SKILLS_BATCH_SIZE,
  EXTRACT_SKILLS_SCHEMA_VERSION,
  EXTRACT_SYSTEM_PROMPT,
  MAX_TOKENS,
  UNDERSTAND_CACHE_TTL_SECONDS,
} from '../llm/llm.constants';
import { toRouteError } from '../llm/route-error';
import type { ChatMessage } from '../provider/chat-message';
import { runLlmAttempts } from '../provider/llm-retry';
import { buildExtractSkillsJsonSchema, parseModelSkillBatch } from './extract-skills.schema';

export interface ExtractSkillsDeps {
  provider: {
    completeStructured(
      messages: ChatMessage[],
      schema: Record<string, unknown>,
      timeoutMs: number,
      maxTokens?: number,
    ): Promise<{ content: string; tokenUsage: TokenUsage }>;
  };
  cache: PromptCache;
  sleep: (ms: number) => Promise<void>;
  model: string;
  logger: Logger;
  now: () => number;
}

/**
 * Extracts skills for each vacancy. Identical title and description share one cache entry;
 * only uncached vacancies go to the model, up to `EXTRACT_SKILLS_BATCH_SIZE` per call.
 */
export async function extractSkills(deps: ExtractSkillsDeps, request: ExtractSkillsRequest): Promise<ExtractSkillsResponse> {
  const found = await readAllCached(deps, request.vacancies);
  const missing = uniqueById(request.vacancies.filter((vacancy) => !found.has(vacancy.id)));
  for (const batch of chunk(missing, EXTRACT_SKILLS_BATCH_SIZE)) {
    for (const result of await completeBatch(deps, batch)) found.set(result.id, result.skills);
    await cacheBatch(deps, batch, found);
  }
  return { results: request.vacancies.map((vacancy) => ({ id: vacancy.id, skills: found.get(vacancy.id) ?? [] })) };
}

async function readAllCached(deps: ExtractSkillsDeps, vacancies: ExtractSkillsVacancy[]): Promise<Map<string, ExtractedSkill[]>> {
  const found = new Map<string, ExtractedSkill[]>();
  for (const vacancy of vacancies) {
    const cached = await readCached(deps, cacheKey(deps, vacancy));
    if (cached !== null) found.set(vacancy.id, cached);
  }
  return found;
}

async function cacheBatch(deps: ExtractSkillsDeps, batch: ExtractSkillsVacancy[], found: Map<string, ExtractedSkill[]>): Promise<void> {
  for (const vacancy of batch) {
    const skills = found.get(vacancy.id) ?? [];
    await writePromptCache(deps.cache, cacheKey(deps, vacancy), JSON.stringify(skills), UNDERSTAND_CACHE_TTL_SECONDS, deps.logger);
  }
}

function cacheKey(deps: ExtractSkillsDeps, vacancy: ExtractSkillsVacancy): string {
  return extractSkillsCacheKey(deps.model, EXTRACT_SKILLS_SCHEMA_VERSION, vacancy);
}

async function readCached(deps: ExtractSkillsDeps, key: string): Promise<ExtractedSkill[] | null> {
  const raw = await readPromptCache(deps.cache, key, deps.logger);
  if (raw === null) return null;
  return parseCached(raw);
}

function parseCached(raw: string): ExtractedSkill[] | null {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as ExtractedSkill[]) : null;
  } catch {
    return null;
  }
}

async function completeBatch(deps: ExtractSkillsDeps, batch: ExtractSkillsVacancy[]): Promise<ExtractedSkills[]> {
  const startedAtMs = deps.now();
  try {
    return await runLlmAttempts({
      sleep: deps.sleep,
      now: deps.now,
      startedAtMs,
      timeoutCapMs: BACKGROUND_ATTEMPT_TIMEOUT_MS,
      budgetMs: BACKGROUND_BUDGET_MS,
      run: (feedback, timeoutMs) => requestBatch(deps, batch, feedback, timeoutMs),
    });
  } catch (error) {
    throw routeOrRethrow(error);
  }
}

async function requestBatch(
  deps: ExtractSkillsDeps,
  batch: ExtractSkillsVacancy[],
  feedback: string | null,
  timeoutMs: number,
): Promise<ExtractedSkills[]> {
  const completion = await deps.provider.completeStructured(
    withFeedback(messagesFor(batch), feedback),
    buildExtractSkillsJsonSchema(),
    timeoutMs,
    MAX_TOKENS.extractSkills,
  );
  return matchIds(asBatch(completion.content), batch);
}

function messagesFor(batch: ExtractSkillsVacancy[]): ChatMessage[] {
  const vacancies = batch.map((vacancy) => ({ id: vacancy.id, title: vacancy.title, description: vacancy.description }));
  return [
    { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify({ vacancies }) },
  ];
}

/** Keeps one result per requested id. A missing id is invalid output, so the retry quotes it. */
function matchIds(results: ExtractedSkills[], batch: ExtractSkillsVacancy[]): ExtractedSkills[] {
  const byId = new Map(results.map((result) => [result.id, result.skills]));
  const missing = batch.filter((vacancy) => !byId.has(vacancy.id)).map((vacancy) => vacancy.id);
  if (missing.length > 0) throw new LlmOutputError(`results are missing ids: ${missing.join(', ')}`);
  return batch.map((vacancy) => ({ id: vacancy.id, skills: byId.get(vacancy.id) ?? [] }));
}

function withFeedback(messages: ChatMessage[], feedback: string | null): ChatMessage[] {
  if (feedback === null) return messages;
  return [...messages, { role: 'user', content: feedback }];
}

function asBatch(content: string): ExtractedSkills[] {
  try {
    return parseModelSkillBatch(parseJson(content));
  } catch (error) {
    if (error instanceof LlmOutputError) throw error;
    throw new LlmOutputError(issueText(error));
  }
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new LlmOutputError('response is not json');
  }
}

function uniqueById(vacancies: ExtractSkillsVacancy[]): ExtractSkillsVacancy[] {
  const seen = new Set<string>();
  return vacancies.filter((vacancy) => !seen.has(vacancy.id) && seen.add(vacancy.id) !== undefined);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
}

function issueText(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  }
  if (error instanceof Error) return error.message;
  return 'invalid model output';
}

function routeOrRethrow(error: unknown): NonNullable<ReturnType<typeof toRouteError>> {
  const route = toRouteError(error);
  if (route === null) throw error;
  return route;
}
