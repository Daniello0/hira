import { describe, expect, it, vi } from 'vitest';
import { ProviderTransportError } from '../llm/llm.errors';
import { createAxiosPost } from './axios-post';

describe('createAxiosPost', () => {
  it('returns the status without throwing on a provider error body', async () => {
    const post = vi.fn(async () => ({ status: 429, data: { error: 'slow' } }));
    const http = createAxiosPost({ post });
    const response = await http.post('https://example.test', { model: 'm' }, {
      headers: { Authorization: 'Bearer sk-test' },
      timeout: 7_000,
    });
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
      http.post('https://example.test', {}, { headers: {}, timeout: 1_000, responseType: 'stream' }),
    ).rejects.toBeInstanceOf(ProviderTransportError);
    expect(post.mock.calls[0]?.[2]).toMatchObject({ responseType: 'stream' });
  });
});
