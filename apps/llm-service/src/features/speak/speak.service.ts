import { z } from 'zod';
import {
  LLM_UPSTREAM_STATUS,
  LLM_UPSTREAM_UNAVAILABLE_CODE,
  LLM_UPSTREAM_UNAVAILABLE_MESSAGE,
  OPENROUTER_SPEECH_PATH,
  SPEAK_TIMEOUT_MS,
  SPEECH_MODEL,
} from '../llm/llm.constants';
import { LlmRouteError } from '../llm/llm.errors';

const speakSchema = z.object({ text: z.string().min(1), voice: z.string().min(1) });

export type SpeakRequest = z.infer<typeof speakSchema>;

/** Reads the body of `POST /internal/v1/speak`. A bad body throws the shared validation error. */
export function parseSpeakRequest(body: unknown): SpeakRequest {
  return speakSchema.parse(body);
}

/** One spoken text as MP3 from OpenRouter. The caller keeps a voice of its own for when this fails. */
export function createSpeaker(config: { apiKey: string; baseUrl: string }, request: typeof fetch = fetch) {
  return async ({ text, voice }: SpeakRequest): Promise<Buffer> => {
    const response = await reachable(() =>
      request(`${config.baseUrl.replace(/\/$/, '')}${OPENROUTER_SPEECH_PATH}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: SPEECH_MODEL, voice, input: text, response_format: 'mp3' }),
        signal: AbortSignal.timeout(SPEAK_TIMEOUT_MS),
      }),
    );
    if (!response.ok) throw upstreamError();
    return Buffer.from(await response.arrayBuffer());
  };
}

async function reachable(call: () => Promise<Response>): Promise<Response> {
  try {
    return await call();
  } catch {
    throw upstreamError();
  }
}

function upstreamError(): LlmRouteError {
  return new LlmRouteError(LLM_UPSTREAM_STATUS, LLM_UPSTREAM_UNAVAILABLE_CODE, LLM_UPSTREAM_UNAVAILABLE_MESSAGE);
}
