import { isRecord } from '../../common/utils/is-record';
import { ProviderTransportError } from '../llm/llm.errors';
import type { StreamEvent } from './stream-event';
import type { TokenUsage } from '@hira/contracts';

const STREAM_ERROR_FINISH = 'error';
const STREAM_ERROR_MESSAGE = 'provider stream failed';

/** Turns an OpenRouter SSE body into deltas and a final usage event. */
export async function* readStreamEvents(source: unknown): AsyncGenerator<StreamEvent> {
  for await (const block of readBlocks(asIterable(source))) {
    if (isDone(block)) return;
    for (const event of eventsFromBlock(block)) yield event;
  }
}

async function* readBlocks(source: AsyncIterable<unknown>): AsyncGenerator<string> {
  let buffer = '';
  for await (const chunk of source) {
    buffer += chunkText(chunk);
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) yield part;
  }
  if (buffer.trim().length > 0) yield buffer;
}

function eventsFromBlock(block: string): StreamEvent[] {
  const payload = dataPayload(block);
  if (payload === null) return [];
  return eventsFromPayload(parsePayload(payload));
}

function dataPayload(block: string): string | null {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim());
  if (data.length === 0) return null;
  return data.join('\n');
}

function isDone(block: string): boolean {
  return dataPayload(block) === '[DONE]';
}

function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    throw new ProviderTransportError(null, 'stream chunk is not json');
  }
}

function eventsFromPayload(payload: unknown): StreamEvent[] {
  if (!isRecord(payload)) throw new ProviderTransportError(null, 'stream chunk is not an object');
  rejectFailedFrame(payload);
  const events: StreamEvent[] = [];
  const text = deltaText(payload);
  if (text !== null) events.push({ kind: 'delta', text });
  const usage = usageFrom(payload.usage);
  if (usage !== null) events.push({ kind: 'usage', tokenUsage: usage });
  return events;
}

function rejectFailedFrame(payload: Record<string, unknown>): void {
  if (!frameFailed(payload)) return;
  throw new ProviderTransportError(null, providerErrorText(payload));
}

function frameFailed(payload: Record<string, unknown>): boolean {
  return hasProviderError(payload) || finishReason(payload) === STREAM_ERROR_FINISH;
}

function hasProviderError(payload: Record<string, unknown>): boolean {
  return payload.error !== undefined && payload.error !== null;
}

function finishReason(payload: Record<string, unknown>): unknown {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  return isRecord(choice) ? choice.finish_reason : undefined;
}

function providerErrorText(payload: Record<string, unknown>): string {
  const error = payload.error;
  if (isRecord(error) && typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }
  return STREAM_ERROR_MESSAGE;
}

function deltaText(payload: Record<string, unknown>): string | null {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  const delta = isRecord(choice) ? choice.delta : undefined;
  const content = isRecord(delta) ? delta.content : undefined;
  if (typeof content !== 'string' || content.length === 0) return null;
  return content;
}

function usageFrom(value: unknown): TokenUsage | null {
  if (!isRecord(value)) return null;
  return {
    promptTokens: count(value.prompt_tokens),
    completionTokens: count(value.completion_tokens),
    totalTokens: count(value.total_tokens),
  };
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asIterable(value: unknown): AsyncIterable<unknown> {
  if (value !== null && typeof value === 'object' && Symbol.asyncIterator in value) {
    return value as AsyncIterable<unknown>;
  }
  throw new ProviderTransportError(null, 'provider stream is missing');
}

function chunkText(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk;
  if (Buffer.isBuffer(chunk)) return chunk.toString('utf8');
  if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString('utf8');
  return '';
}
