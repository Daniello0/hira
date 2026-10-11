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
  ): Promise<{ status: number; data: unknown }>;
}

interface Deadline {
  signal: AbortSignal;
  stop: () => void;
}

/** Axios adapter that returns provider statuses and aborts a live stream at the attempt deadline. */
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
): Promise<{ status: number; data: unknown }> {
  const deadline = startDeadline(init.timeout);
  try {
    const response = await client.post(url, body, requestConfig(init, deadline.signal));
    return attachStreamDeadline(response, init.responseType, deadline);
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

function attachStreamDeadline(
  response: { status: number; data: unknown },
  responseType: HttpInit['responseType'],
  deadline: Deadline,
): { status: number; data: unknown } {
  if (responseType !== 'stream' || !(response.data instanceof Readable)) {
    deadline.stop();
    return response;
  }
  return { status: response.status, data: streamWithDeadline(response.data, deadline) };
}

function startDeadline(timeoutMs: number): Deadline {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, stop: () => clearTimeout(timer) };
}

function streamWithDeadline(stream: Readable, deadline: Deadline): AsyncIterable<unknown> {
  const onAbort = (): void => destroyAtDeadline(stream);
  deadline.signal.addEventListener('abort', onAbort);
  return {
    [Symbol.asyncIterator]: () => readUntilDeadline(stream, deadline, onAbort),
  };
}

async function* readUntilDeadline(
  stream: Readable,
  deadline: Deadline,
  onAbort: () => void,
): AsyncGenerator<unknown> {
  try {
    failIfAlreadyAborted(stream, deadline);
    for await (const chunk of stream) yield chunk;
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

function asTransport(error: unknown, aborted: boolean): ProviderTransportError {
  if (error instanceof ProviderTransportError) return error;
  const message = aborted ? DEADLINE_EXCEEDED_MESSAGE : 'request failed';
  return new ProviderTransportError(null, message);
}
