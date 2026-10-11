import type { GenerateRequest, TokenUsage } from '@hira/contracts';
import { buildGenerateMessages } from './build-generate-messages';
import { GENERATE_ATTEMPT_TIMEOUT_MS, SSE_DONE_EVENT, SSE_TOKEN_EVENT, ZERO_TOKEN_USAGE } from '../llm/llm.constants';
import { StreamInterruptedError } from '../llm/llm.errors';
import { toRouteError } from '../llm/route-error';
import { runLlmAttempts } from '../provider/llm-retry';
import type { ChatMessage } from '../provider/chat-message';
import type { StreamEvent } from '../provider/stream-event';

export interface LlmStreamEvent {
  name: typeof SSE_TOKEN_EVENT | typeof SSE_DONE_EVENT;
  data: unknown;
}

export interface GenerateDeps {
  provider: {
    streamText(messages: ChatMessage[], timeoutMs: number): AsyncIterable<StreamEvent>;
  };
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  startedAtMs?: number;
}

/** Streams a grounded answer. A failure after the first token is not retried. */
export async function generateAnswer(
  deps: GenerateDeps,
  request: GenerateRequest,
  emit: (event: LlmStreamEvent) => void,
): Promise<void> {
  try {
    await runLlmAttempts({
      sleep: deps.sleep,
      now: deps.now,
      startedAtMs: deps.startedAtMs ?? deps.now(),
      timeoutCapMs: GENERATE_ATTEMPT_TIMEOUT_MS,
      run: (feedback, timeoutMs) => streamOnce(deps, request, feedback, timeoutMs, emit),
    });
  } catch (error) {
    if (error instanceof StreamInterruptedError) throw error;
    throw routeOrRethrow(error);
  }
}

async function streamOnce(
  deps: GenerateDeps,
  request: GenerateRequest,
  feedback: string | null,
  timeoutMs: number,
  emit: (event: LlmStreamEvent) => void,
): Promise<void> {
  const messages = withFeedback(buildGenerateMessages(request), feedback);
  const usage = await readDeltas(deps, messages, timeoutMs, emit);
  emit({ name: SSE_DONE_EVENT, data: { meta: { tokenUsage: usage } } });
}

async function readDeltas(
  deps: GenerateDeps,
  messages: ChatMessage[],
  timeoutMs: number,
  emit: (event: LlmStreamEvent) => void,
): Promise<TokenUsage> {
  let emitted = false;
  let tokenUsage: TokenUsage = { ...ZERO_TOKEN_USAGE };
  try {
    for await (const event of deps.provider.streamText(messages, timeoutMs)) {
      emitted = applyEvent(event, emit) || emitted;
      if (event.kind === 'usage') tokenUsage = event.tokenUsage;
    }
  } catch (error) {
    if (emitted) throw new StreamInterruptedError(error);
    throw error;
  }
  return tokenUsage;
}

function applyEvent(event: StreamEvent, emit: (item: LlmStreamEvent) => void): boolean {
  if (event.kind !== 'delta' || event.text.length === 0) return false;
  emit({ name: SSE_TOKEN_EVENT, data: { delta: event.text } });
  return true;
}

function withFeedback(messages: ChatMessage[], feedback: string | null): ChatMessage[] {
  if (feedback === null) return messages;
  return [...messages, { role: 'user', content: feedback }];
}

function routeOrRethrow(error: unknown): NonNullable<ReturnType<typeof toRouteError>> {
  const route = toRouteError(error);
  if (route === null) throw error;
  return route;
}
