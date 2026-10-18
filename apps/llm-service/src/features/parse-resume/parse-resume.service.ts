import type { ParseResumeRequest, ParseResumeResponse } from '@hira/contracts';
import type { Logger } from 'pino';
import { readPromptCache, writePromptCache, type PromptCache } from '../cache/prompt-cache';
import { parseResumeCacheKey } from '../cache/parse-resume-cache-key';
import { completeJson, type StructuredDeps } from '../llm/complete-json';
import { PARSE_RESUME_SCHEMA_VERSION, UNDERSTAND_CACHE_TTL_SECONDS } from '../llm/llm.constants';
import { buildParseResumeJsonSchema, parseResumeModel } from './parse-resume.schema';

const SYSTEM_PROMPT =
  'Extract skills and experience lines from the resume. Use only the provided level enum or null. Do not invent employers.';

export interface ParseResumeDeps extends StructuredDeps {
  cache: PromptCache;
  model: string;
  logger: Logger;
}

/** Parses resume text, reusing a cached result for the same text. */
export async function parseResume(deps: ParseResumeDeps, request: ParseResumeRequest): Promise<ParseResumeResponse> {
  const key = parseResumeCacheKey(deps.model, PARSE_RESUME_SCHEMA_VERSION, request.resumeText);
  const cached = await readCached(deps, key);
  if (cached !== null) return cached;
  const parsed = await completeJson(deps, messages(request.resumeText), buildParseResumeJsonSchema(), parseResumeModel);
  await writePromptCache(deps.cache, key, JSON.stringify(parsed), UNDERSTAND_CACHE_TTL_SECONDS, deps.logger);
  return parsed;
}

async function readCached(deps: ParseResumeDeps, key: string): Promise<ParseResumeResponse | null> {
  const raw = await readPromptCache(deps.cache, key, deps.logger);
  if (raw === null) return null;
  return parseCached(raw);
}

function parseCached(raw: string): ParseResumeResponse | null {
  try {
    return parseResumeModel(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function messages(resumeText: string) {
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: resumeText },
  ];
}
