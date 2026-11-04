import type { ApiErrorResponse } from '@hira/contracts';
import { authedFetch } from '../../common/api/authed-fetch';
import { createSseParser, type ParsedSse } from './sse-parser';

export interface StreamResult {
  opened: boolean;
  status: number;
  error: ApiErrorResponse | null;
  interrupted: boolean;
}

/**
 * Posts one turn and reads SSE. A network failure before headers is not an open stream.
 * A 401 is refreshed and repeated once by `authedFetch`; the server stored nothing then.
 */
export async function postStream(path: string, body: object, onEvent: (event: ParsedSse) => void, signal?: AbortSignal): Promise<StreamResult> {
  const response = await post(path, body, signal);
  if (response === null) return { opened: false, status: 0, error: null, interrupted: false };
  if (!response.ok) return { opened: false, status: response.status, error: await readError(response), interrupted: false };
  return readOpenStream(response, onEvent);
}

async function post(path: string, body: object, signal?: AbortSignal): Promise<Response | null> {
  try {
    return await authedFetch(path, { ...jsonPost(body), ...(signal === undefined ? {} : { signal }) });
  } catch {
    return null;
  }
}

function jsonPost(body: object): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
  };
}

async function readOpenStream(response: Response, onEvent: (event: ParsedSse) => void): Promise<StreamResult> {
  try {
    await readEventStream(response, onEvent);
    return { opened: true, status: response.status, error: null, interrupted: false };
  } catch {
    return { opened: true, status: response.status, error: null, interrupted: true };
  }
}

/**
 * A stream silent this long is dead even if the socket is not: the server writes a keep-alive line every 15 s
 * while it searches and writes. Giving up lets the chat reload what the server kept instead of spinning forever.
 */
export const STREAM_IDLE_MS = 90_000;

/** Reads `text/event-stream` until the body closes. Rejects when it goes quiet for `idleMs`. */
export async function readEventStream(response: Response, onEvent: (event: ParsedSse) => void, idleMs = STREAM_IDLE_MS): Promise<void> {
  const reader = response.body?.getReader();
  if (reader === undefined) return;
  const decoder = new TextDecoder();
  const parser = createSseParser();
  let chunk = await readWithin(reader, idleMs);
  while (!chunk.done) {
    for (const event of parser.push(decoder.decode(chunk.value, { stream: true }))) onEvent(event);
    chunk = await readWithin(reader, idleMs);
  }
}

async function readWithin(reader: ReadableStreamDefaultReader<Uint8Array>, idleMs: number): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const quiet = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Rejected first: cancelling also ends the pending read, which must not look like a normal end.
      reject(new Error('The answer stream went quiet'));
      void reader.cancel().catch(() => undefined);
    }, idleMs);
  });
  try {
    return await Promise.race([reader.read(), quiet]);
  } finally {
    clearTimeout(timer);
  }
}

async function readError(response: Response): Promise<ApiErrorResponse | null> {
  try {
    return (await response.json()) as ApiErrorResponse;
  } catch {
    return null;
  }
}
