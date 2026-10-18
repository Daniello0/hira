import type { ExtractSkillsRequest, GenerateRequest, UnderstandRequest } from '@hira/contracts';
import axios from 'axios';
import type { Logger } from 'pino';
import type { Router } from 'express';
import { delay } from '../../common/utils/delay';
import { createRedisPromptCache } from '../cache/prompt-cache';
import { generateAnswer, type LlmStreamEvent } from '../generate/generate.service';
import { createAxiosPost } from '../provider/axios-post';
import { createOpenRouterClient } from '../provider/openrouter-client';
import { createLlmRedisClient, readLlmRedisUrl } from '../provider/redis-client';
import { extractMemory } from '../extract-memory/extract-memory.service';
import { parseResume } from '../parse-resume/parse-resume.service';
import { summarizeChat } from '../summarize-chat/summarize-chat.service';
import { extractSkills } from '../extract-skills/extract-skills.service';
import { understandQuery } from '../understand/understand.service';
import { createLlmRouter } from './llm.router';
import { readLlmConfig } from './read-llm-config';

/** Wires OpenRouter and Redis into the internal router. */
export function buildLlmRouter(logger: Logger, env: NodeJS.ProcessEnv): Router {
  const config = readLlmConfig(env);
  const provider = createOpenRouterClient(createAxiosPost(axios.create()), config);
  const cache = createRedisPromptCache(createLlmRedisClient(readLlmRedisUrl(env)));
  return createLlmRouter({
    apiKey: config.apiKey,
    model: config.model,
    understand: (request) => understandWith(logger, config.model, provider, cache, request),
    generate: (request, emit) => generateWith(provider, request, emit),
    extractSkills: (request) => extractWith(logger, config.model, provider, cache, request),
    summarize: (request) => summarizeChat({ provider, sleep: delay, now: Date.now }, request),
    extractMemory: (request) => extractMemory({ provider, sleep: delay, now: Date.now }, request),
    parseResume: (request) =>
      parseResume({ provider, cache, sleep: delay, model: config.model, logger, now: Date.now }, request),
  });
}

function understandWith(
  logger: Logger,
  model: string,
  provider: ReturnType<typeof createOpenRouterClient>,
  cache: ReturnType<typeof createRedisPromptCache>,
  request: UnderstandRequest,
) {
  return understandQuery({ provider, cache, sleep: delay, model, logger, now: Date.now }, request);
}

function extractWith(
  logger: Logger,
  model: string,
  provider: ReturnType<typeof createOpenRouterClient>,
  cache: ReturnType<typeof createRedisPromptCache>,
  request: ExtractSkillsRequest,
) {
  return extractSkills({ provider, cache, sleep: delay, model, logger, now: Date.now }, request);
}

function generateWith(
  provider: ReturnType<typeof createOpenRouterClient>,
  request: GenerateRequest,
  emit: (event: LlmStreamEvent) => void,
) {
  return generateAnswer({ provider, sleep: delay, now: Date.now }, request, emit);
}
