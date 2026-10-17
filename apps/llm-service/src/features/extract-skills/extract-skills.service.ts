import type {
  ExtractedSkill,
  ExtractSkillsRequest,
  ExtractSkillsResponse,
  TokenUsage,
} from '@hira/contracts';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { readPromptCache, writePromptCache, type PromptCache } from '../cache/prompt-cache';
import { extractSkillsCacheKey } from '../cache/extract-skills-cache-key';
import { LlmOutputError } from '../llm/llm.errors';
import {
  EXTRACT_SKILLS_SCHEMA_VERSION,
  EXTRACT_SYSTEM_PROMPT,
  UNDERSTAND_ATTEMPT_TIMEOUT_MS,
  UNDERSTAND_CACHE_TTL_SECONDS,
} from '../llm/llm.constants';
import { toRouteError } from '../llm/route-error';
import type { ChatMessage } from '../provider/chat-message';
import { runLlmAttempts } from '../provider/llm-retry';
import { buildExtractSkillsJsonSchema, parseModelSkills } from './extract-skills.schema';

export interface ExtractSkillsDeps {
  provider: {
    completeStructured(
      messages: ChatMessage[],
      schema: Record<string, unknown>,
      timeoutMs: number,
    ): Promise<{ content: string; tokenUsage: TokenUsage }>;
  };
  cache: PromptCache;
  sleep: (ms: number) => Promise<void>;
  model: string;
  logger: Logger;
  now: () => number;
}

/** Extracts skills for each vacancy. Identical title and description share one cache entry. */
export async function extractSkills(
  deps: ExtractSkillsDeps,
  request: ExtractSkillsRequest,
): Promise<ExtractSkillsResponse> {
  const results = [];
  for (const vacancy of request.vacancies) {
    results.push({ id: vacancy.id, skills: await oneVacancy(deps, vacancy) });
  }
  return { results };
}

async function oneVacancy(
  deps: ExtractSkillsDeps,
  vacancy: ExtractSkillsRequest['vacancies'][number],
): Promise<ExtractedSkill[]> {
  const key = extractSkillsCacheKey(deps.model, EXTRACT_SKILLS_SCHEMA_VERSION, vacancy);
  const cached = await readCached(deps, key);
  if (cached !== null) return cached;
  const skills = await completeSkills(deps, vacancy);
  await writePromptCache(
    deps.cache,
    key,
    JSON.stringify(skills),
    UNDERSTAND_CACHE_TTL_SECONDS,
    deps.logger,
  );
  return skills;
}

async function readCached(deps: ExtractSkillsDeps, key: string): Promise<ExtractedSkill[] | null> {
  const raw = await readPromptCache(deps.cache, key, deps.logger);
  if (raw === null) return null;
  return parseCached(raw);
}

function parseCached(raw: string): ExtractedSkill[] | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return null;
    return value as ExtractedSkill[];
  } catch {
    return null;
  }
}

async function completeSkills(
  deps: ExtractSkillsDeps,
  vacancy: ExtractSkillsRequest['vacancies'][number],
): Promise<ExtractedSkill[]> {
  const startedAtMs = deps.now();
  try {
    return await runLlmAttempts({
      sleep: deps.sleep,
      now: deps.now,
      startedAtMs,
      timeoutCapMs: UNDERSTAND_ATTEMPT_TIMEOUT_MS,
      run: (feedback, timeoutMs) => requestSkills(deps, vacancy, feedback, timeoutMs),
    });
  } catch (error) {
    throw routeOrRethrow(error);
  }
}

async function requestSkills(
  deps: ExtractSkillsDeps,
  vacancy: ExtractSkillsRequest['vacancies'][number],
  feedback: string | null,
  timeoutMs: number,
): Promise<ExtractedSkill[]> {
  const completion = await deps.provider.completeStructured(
    withFeedback(messagesFor(vacancy), feedback),
    buildExtractSkillsJsonSchema(),
    timeoutMs,
  );
  return asSkills(completion.content);
}

function messagesFor(vacancy: ExtractSkillsRequest['vacancies'][number]): ChatMessage[] {
  return [
    { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
    { role: 'user', content: `${vacancy.title}\n${vacancy.description}` },
  ];
}

function withFeedback(messages: ChatMessage[], feedback: string | null): ChatMessage[] {
  if (feedback === null) return messages;
  return [...messages, { role: 'user', content: feedback }];
}

function asSkills(content: string): ExtractedSkill[] {
  try {
    return parseModelSkills(parseJson(content)).skills;
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
