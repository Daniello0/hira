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
export async function postStream(path: string, body: object, onEvent: (event: ParsedSse) => void): Promise<StreamResult> {
  const response = await post(path, body);
  if (response === null) return { opened: false, status: 0, error: null, interrupted: false };
  if (!response.ok) return { opened: false, status: response.status, error: await readError(response), interrupted: false };
  return readOpenStream(response, onEvent);
}

async function post(path: string, body: object): Promise<Response | null> {
  try {
    return await authedFetch(path, jsonPost(body));
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

/** Reads `text/event-stream` until the body closes. */
export async function readEventStream(response: Response, onEvent: (event: ParsedSse) => void): Promise<void> {
  const reader = response.body?.getReader();
  if (reader === undefined) return;
  const decoder = new TextDecoder();
  const parser = createSseParser();
  let chunk = await reader.read();
  while (!chunk.done) {
    for (const event of parser.push(decoder.decode(chunk.value, { stream: true }))) onEvent(event);
    chunk = await reader.read();
  }
}

async function readError(response: Response): Promise<ApiErrorResponse | null> {
  try {
    return (await response.json()) as ApiErrorResponse;
  } catch {
    return null;
  }
}
