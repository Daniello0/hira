import { VoiceLanguage } from '@hira/contracts';

export const LLM_PROVIDER_HEADER = 'X-LLM-Provider';
export const LLM_PROVIDER_ID = 'openrouter';
export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_CHAT_COMPLETIONS_PATH = '/chat/completions';
export const SEARCH_INTENT_SCHEMA_NAME = 'search_intent';
export const SEARCH_INTENT_SCHEMA_VERSION = '3';
export const UNDERSTAND_TEMPERATURE = 0;
export const GENERATE_TEMPERATURE = 0.2;
export const OPENROUTER_REASONING_EFFORT = 'minimal';
export const OPENROUTER_EXCLUDE_REASONING = true;
export const OPENROUTER_REQUIRE_PARAMETERS = true;
export const MAX_LLM_ATTEMPTS = 3;
export const RETRY_BACKOFF_MS = [200, 800] as const;
export const LLM_BUDGET_MS = 20_000;
export const UNDERSTAND_ATTEMPT_TIMEOUT_MS = 7_000;
/** Generate: wait this long for the first streamed byte of an attempt. */
export const GENERATE_FIRST_BYTE_TIMEOUT_MS = 20_000;
/** Generate: abort when the stream goes quiet this long between chunks. A long answer is not cut. */
export const GENERATE_IDLE_TIMEOUT_MS = 20_000;
/** Summary, memory extraction, resume parsing, and skill batches run off the chat path and get longer. */
export const BACKGROUND_ATTEMPT_TIMEOUT_MS = 25_000;
/** Attempt budget of a background call; core-api waits `LLM_BACKGROUND_TIMEOUT_MS` (60 s) for it. */
export const BACKGROUND_BUDGET_MS = 55_000;
/** `max_tokens` per call type, so a runaway answer cannot burn the free plan. */
export const MAX_TOKENS = {
  understand: 600,
  generate: 1_200,
  draft: 1_500,
  summary: 400,
  extractMemory: 800,
  parseResume: 1_500,
  extractSkills: 1_500,
} as const;
/** Vacancies sent to the model in one extract-skills call. */
export const EXTRACT_SKILLS_BATCH_SIZE = 5;
/** Status the provider uses for rate limits. It is not retried: the free plan would only spend more. */
export const RATE_LIMITED_STATUS = 429;
export const LLM_RATE_LIMITED_CODE = 'LLM_RATE_LIMITED';
export const LLM_RATE_LIMITED_MESSAGE = 'The language model is rate limited';
export const UNDERSTAND_CACHE_TTL_SECONDS = 86_400;
export const UNDERSTAND_CACHE_PREFIX = 'llm:understand:';
export const EXTRACT_SKILLS_CACHE_PREFIX = 'llm:extract-skills:';
export const EXTRACT_SKILLS_SCHEMA_VERSION = '1';
export const EXTRACT_SKILLS_SCHEMA_NAME = 'extracted_skills';
export const PARSE_RESUME_CACHE_PREFIX = 'llm:parse-resume:';
export const PARSE_RESUME_SCHEMA_VERSION = '1';
export const PARSE_RESUME_SCHEMA_NAME = 'parsed_resume';
export const EXTRACT_SYSTEM_PROMPT =
  'Extract skills mentioned in each vacancy. Return one result per vacancy with its exact id. Use only the provided enums. evidenceSpan must be a substring of that vacancy description or null.';
export const MAX_GENERATE_RESULTS = 10;
export const LLM_INVALID_OUTPUT_CODE = 'LLM_INVALID_OUTPUT';
export const LLM_INVALID_OUTPUT_MESSAGE = 'The model returned an invalid structured result';
export const LLM_UPSTREAM_UNAVAILABLE_CODE = 'LLM_UPSTREAM_UNAVAILABLE';
export const LLM_UPSTREAM_UNAVAILABLE_MESSAGE = 'The language model is unavailable';
export const LLM_NOT_CONFIGURED_CODE = 'LLM_NOT_CONFIGURED';
export const LLM_NOT_CONFIGURED_MESSAGE = 'The language model is not configured';
export const VALIDATION_FAILED_CODE = 'VALIDATION_FAILED';
export const VALIDATION_FAILED_MESSAGE = 'Request validation failed';
export const LLM_INVALID_OUTPUT_STATUS = 422;
export const LLM_UPSTREAM_STATUS = 502;
export const LLM_NOT_CONFIGURED_STATUS = 503;
export const VALIDATION_FAILED_STATUS = 400;
export const SSE_TOKEN_EVENT = 'token';
export const SSE_DONE_EVENT = 'done';
export const SSE_ERROR_EVENT = 'error';
/** Added to every reply prompt that may carry the facts block. */
const FACTS_RULE =
  " Lines under 'Known facts' are true data about the catalog and this user: answer questions about the catalog size, regions, remote work, the user's profile, saved vacancies, earlier chats and calls from them. Each vacancy line states its city and its site: say them when asked. Say a value is unknown only when its line says so.";
export const GENERATE_SYSTEM_PROMPT = `You are Hira, a job-search assistant. Always answer in the language of the latest user message. Use only the vacancies, explanations, and known facts provided. Do not invent vacancies.${FACTS_RULE}`;
export const CAREER_ADVICE_SYSTEM_PROMPT =
  `You are Hira, a career assistant. Always answer in the language of the latest user message. Give practical, specific career advice for that message, using the chat summary and the user's files when they help. Do not list or invent vacancies; offer a search if one would help.${FACTS_RULE}`;
export const SMALL_TALK_SYSTEM_PROMPT =
  `You are Hira, a job-search assistant. Always answer in the language of the latest user message. Reply briefly and naturally, and offer to help find vacancies or plan a career step when it fits. Do not invent vacancies.${FACTS_RULE}`;
/** Added on a call: the reply is heard, not read, and the cards on screen carry the details. */
export const VOICE_RULE =
  ' This is a voice call and your reply will be spoken aloud. Answer in two or three short spoken sentences, in plain words, with no Markdown, lists, tables, or links. Mention at most the top two vacancies; the screen shows the rest.';
export const VOICE_LANGUAGE_NAMES: Readonly<Record<VoiceLanguage, string>> = {
  [VoiceLanguage.Russian]: 'Russian',
  [VoiceLanguage.English]: 'English',
  [VoiceLanguage.Spanish]: 'Spanish',
  [VoiceLanguage.German]: 'German',
  [VoiceLanguage.French]: 'French',
};
export const DRAFT_SYSTEM_PROMPT =
  "Write the full text of the file the user asked for, in Markdown, in the language of the latest user message. Output only the file text: no preamble, no closing remarks, no code fences. When the user names one of the given files, return that whole file updated and keep what still applies. Take facts from the user's files and the chat; never invent employers, dates, or contacts - leave a short placeholder such as [Company] instead.";
export const EMPTY_RESULTS_LINE = 'No vacancies were retrieved.';
export const UNDERSTAND_SYSTEM_PROMPT =
  'Rewrite the query so it stands alone, using the history and memory. Extract role, skills, seniority, constraints, complexity, and intent. A stated work format, city, or salary floor is a hard constraint. Do not guess an employment type. intentType: SEARCH, REFINE, or COMPARE for vacancy searches; CAREER_ADVICE for career questions that need no vacancy list; SMALL_TALK for greetings, chit-chat, and questions about what Hira already knows: how many vacancies there are, the profile or saved vacancies of the user, earlier chats, or the city or site of a vacancy already shown; DRAFT_DOCUMENT when the user asks to write, draft, save, or extend a file such as a cover letter, notes, preferences, or an interview script.';
/** Shown to the model beside the intent enum in the JSON schema. */
export const INTENT_TYPE_DESCRIPTION =
  'SEARCH/REFINE/COMPARE: find or adjust vacancies. CAREER_ADVICE: career question, no vacancy list. SMALL_TALK: greeting, chit-chat, or a question about the catalog size, the saved vacancies of the user, earlier chats, or a vacancy already shown. DRAFT_DOCUMENT: write, save, draft, or extend a letter, notes, preferences, or script file.';
export const LATEST_MESSAGE_LABEL = 'Latest user message';
export const ZERO_TOKEN_USAGE = { promptTokens: 0, completionTokens: 0, totalTokens: 0 } as const;
