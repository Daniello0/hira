import { ProviderTransportError } from '../llm/llm.errors';
import type { HttpInit, HttpPost } from './openrouter-client';

interface AxiosLike {
  post(
    url: string,
    body: unknown,
    config: {
      headers: Record<string, string>;
      timeout: number;
      responseType: 'json' | 'stream';
      validateStatus: () => boolean;
    },
  ): Promise<{ status: number; data: unknown }>;
}

/** Axios adapter that returns provider HTTP statuses and wraps socket failures. */
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
  try {
    return await client.post(url, body, {
      headers: init.headers,
      timeout: init.timeout,
      responseType: init.responseType === 'stream' ? 'stream' : 'json',
      validateStatus: () => true,
    });
  } catch (error) {
    if (error instanceof ProviderTransportError) throw error;
    throw new ProviderTransportError(null, 'request failed');
  }
}
