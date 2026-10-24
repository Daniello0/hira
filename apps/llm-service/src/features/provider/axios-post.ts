import { Readable } from 'node:stream';
import { ProviderTransportError } from '../llm/llm.errors';
import type { HttpInit, HttpPost } from './openrouter-client';

const DEADLINE_EXCEEDED_MESSAGE = 'language model deadline exceeded';

interface AxiosRequestConfig {
  headers: Record<string, string>;
  timeout: number;
  responseType: 'json' | 'stream';
  validateStatus: () => boolean;
  signal: AbortSignal;
}

interface AxiosLike {
  post(
    url: string,
    body: unknown,
    config: AxiosRequestConfig,
  ): Promise<{ status: number; data: unknown; headers?: unknown }>;
}

interface Deadline {
  signal: AbortSignal;
  stop: () => void;
  /** Starts a fresh countdown, used after every streamed chunk. */
  restart: (timeoutMs: number) => void;
}

type HttpResult = { status: number; data: unknown; headers?: Record<string, unknown> };

/**
 * Axios adapter that returns provider statuses and headers.
 * `timeout` bounds the wait for the response (the first byte of a stream); with `idleTimeout`
 * a live stream is then aborted only when it goes quiet that long between chunks.
 */
export function createAxiosPost(client: AxiosLike): HttpPost {
  return {
    post: (url, body, init) => post(client, url, body, init),
  };
}

async function post(
  client: AxiosLike,
  url: string,
  body: unknown,
  init: HttpInit,
): Promise<HttpResult> {
  const deadline = startDeadline(init.timeout);
  try {
    const response = await client.post(url, body, requestConfig(init, deadline.signal));
    const result = { status: response.status, data: response.data, headers: readHeaders(response.headers) };
    return attachStreamDeadline(result, init, deadline);
  } catch (error) {
    deadline.stop();
    throw asTransport(error, deadline.signal.aborted);
  }
}

function requestConfig(init: HttpInit, signal: AbortSignal): AxiosRequestConfig {
  return {
    headers: init.headers,
    timeout: init.timeout,
    responseType: init.responseType === 'stream' ? 'stream' : 'json',
    validateStatus: () => true,
    signal,
  };
}

function attachStreamDeadline(response: HttpResult, init: HttpInit, deadline: Deadline): HttpResult {
  if (init.responseType !== 'stream' || !(response.data instanceof Readable)) {
    deadline.stop();
    return response;
  }
  return { ...response, data: streamWithDeadline(response.data, deadline, init.idleTimeout) };
}

function startDeadline(timeoutMs: number): Deadline {
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    stop: () => clearTimeout(timer),
    restart: (nextMs) => {
      clearTimeout(timer);
      if (!controller.signal.aborted) timer = setTimeout(() => controller.abort(), nextMs);
    },
  };
}

function streamWithDeadline(stream: Readable, deadline: Deadline, idleTimeoutMs: number | undefined): AsyncIterable<unknown> {
  const onAbort = (): void => destroyAtDeadline(stream);
  deadline.signal.addEventListener('abort', onAbort);
  return {
    [Symbol.asyncIterator]: () => readUntilDeadline(stream, deadline, onAbort, idleTimeoutMs),
  };
}

async function* readUntilDeadline(
  stream: Readable,
  deadline: Deadline,
  onAbort: () => void,
  idleTimeoutMs: number | undefined,
): AsyncGenerator<unknown> {
  try {
    failIfAlreadyAborted(stream, deadline);
    for await (const chunk of stream) {
      if (idleTimeoutMs !== undefined) deadline.restart(idleTimeoutMs);
      yield chunk;
    }
  } catch (error) {
    throw asTransport(error, deadline.signal.aborted);
  } finally {
    deadline.signal.removeEventListener('abort', onAbort);
    deadline.stop();
  }
}

function failIfAlreadyAborted(stream: Readable, deadline: Deadline): void {
  if (!deadline.signal.aborted) return;
  destroyAtDeadline(stream);
  throw new ProviderTransportError(null, DEADLINE_EXCEEDED_MESSAGE);
}

function destroyAtDeadline(stream: Readable): void {
  if (stream.destroyed) return;
  ensureErrorListener(stream);
  stream.destroy(new ProviderTransportError(null, DEADLINE_EXCEEDED_MESSAGE));
}

function ensureErrorListener(stream: Readable): void {
  if (stream.listenerCount('error') > 0) return;
  stream.once('error', keepStreamErrorHandled);
}

function keepStreamErrorHandled(): void {
  return undefined;
}

function readHeaders(headers: unknown): Record<string, unknown> | undefined {
  if (typeof headers !== 'object' || headers === null) return undefined;
  const plain = 'toJSON' in headers && typeof headers.toJSON === 'function' ? (headers.toJSON() as unknown) : headers;
  return typeof plain === 'object' && plain !== null ? (plain as Record<string, unknown>) : undefined;
}

function asTransport(error: unknown, aborted: boolean): ProviderTransportError {
  if (error instanceof ProviderTransportError) return error;
  const message = aborted ? DEADLINE_EXCEEDED_MESSAGE : 'request failed';
  return new ProviderTransportError(null, message);
}
