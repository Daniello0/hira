import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { ProviderTransportError } from '../llm/llm.errors';
import { createAxiosPost } from './axios-post';

describe('createAxiosPost', () => {
  it('returns the status without throwing on a provider error body', async () => {
    const post = vi.fn(async () => ({ status: 429, data: { error: 'slow' } }));
    const http = createAxiosPost({ post });
    const response = await http.post(
      'https://example.test',
      { model: 'm' },
      {
        headers: { Authorization: 'Bearer sk-test' },
        timeout: 7_000,
      },
    );
    expect(response).toEqual({ status: 429, data: { error: 'slow' } });
    expect(post.mock.calls[0]?.[2]).toMatchObject({
      timeout: 7_000,
      responseType: 'json',
      validateStatus: expect.any(Function),
    });
  });

  it('asks axios for a stream and wraps a socket failure', async () => {
    const post = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    const http = createAxiosPost({ post });
    await expect(
      http.post(
        'https://example.test',
        {},
        { headers: {}, timeout: 1_000, responseType: 'stream' },
      ),
    ).rejects.toBeInstanceOf(ProviderTransportError);
    expect(post.mock.calls[0]?.[2]).toMatchObject({ responseType: 'stream' });
  });

  it('aborts a live stream when the attempt clock runs out', async () => {
    vi.useFakeTimers();
    try {
      const stream = new PassThrough();
      const http = createAxiosPost({ post: async () => ({ status: 200, data: stream }) });
      const response = await http.post('https://example.test', {}, streamInit(2_000));
      const reading = readChunks(response.data);
      stream.write('token');
      await vi.advanceTimersByTimeAsync(1_999);
      stream.write('more');
      const settled = expect(reading).rejects.toBeInstanceOf(ProviderTransportError);
      await vi.advanceTimersByTimeAsync(1);
      await settled;
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not abort a stream that already finished', async () => {
    vi.useFakeTimers();
    try {
      const stream = new PassThrough();
      let signal: AbortSignal | undefined;
      const http = createAxiosPost({
        post: async (_url, _body, config) => {
          signal = config.signal;
          return { status: 200, data: stream };
        },
      });
      const response = await http.post('https://example.test', {}, streamInit(2_000));
      stream.end('ok');
      await expect(readChunks(response.data)).resolves.toEqual(['ok']);
      await vi.advanceTimersByTimeAsync(2_000);
      expect(signal?.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the deadline after a json response', async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const http = createAxiosPost({
        post: async (_url, _body, config) => {
          signal = config.signal;
          return { status: 200, data: { ok: true } };
        },
      });
      await http.post('https://example.test', {}, { headers: {}, timeout: 2_000 });
      await vi.advanceTimersByTimeAsync(2_000);
      expect(signal?.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

function streamInit(timeout: number) {
  return { headers: {}, timeout, responseType: 'stream' as const };
}

async function readChunks(source: unknown): Promise<string[]> {
  if (!isAsyncIterable(source)) throw new Error('expected a stream');
  const chunks: string[] = [];
  for await (const chunk of source) chunks.push(chunkText(chunk));
  return chunks;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return value !== null && typeof value === 'object' && Symbol.asyncIterator in value;
}

function chunkText(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk;
  if (Buffer.isBuffer(chunk)) return chunk.toString('utf8');
  return String(chunk);
}
