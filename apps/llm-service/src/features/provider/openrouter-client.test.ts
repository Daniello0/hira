import { describe, expect, it } from 'vitest';
import { LlmOutputError, ProviderTransportError } from '../llm/llm.errors';
import { createOpenRouterClient, type HttpPost } from './openrouter-client';

const usage = { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 };
const mappedUsage = { promptTokens: 4, completionTokens: 5, totalTokens: 9 };

describe('createOpenRouterClient', () => {
  it('sends a strict json schema and keeps the key out of the body', async () => {
    const http = fakeHttp({
      status: 200,
      data: { choices: [{ message: { content: '{"ok":true}' } }], usage },
    });
    const client = clientWith(http);
    const schema = { type: 'object', additionalProperties: false };
    const result = await client.completeStructured(
      [{ role: 'user', content: 'remote?' }],
      schema,
      7_000,
    );
    expect(result).toEqual({ content: '{"ok":true}', tokenUsage: mappedUsage });
    expect(http.last?.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(http.last?.init.timeout).toBe(7_000);
    expect(http.last?.init.headers.Authorization).toBe('Bearer sk-test');
    const body = http.last?.body as Record<string, unknown>;
    expect(body.model).toBe('test-model');
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'search_intent', strict: true, schema },
    });
    expect(JSON.stringify(body)).not.toContain('sk-test');
  });

  it('uses zero token counts when the provider omits usage', async () => {
    const http = fakeHttp({
      status: 200,
      data: { choices: [{ message: { content: '{}' } }] },
    });
    const result = await clientWith(http).completeStructured([], {}, 1_000);
    expect(result.tokenUsage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('treats an empty completion as invalid output', async () => {
    const http = fakeHttp({ status: 200, data: { choices: [{ message: { content: '  ' } }] } });
    await expect(clientWith(http).completeStructured([], {}, 1_000)).rejects.toBeInstanceOf(
      LlmOutputError,
    );
  });

  it('preserves provider status and maps a network failure to a null status', async () => {
    const refused = fakeHttp({ status: 400, data: { error: 'no' } });
    await expect(clientWith(refused).completeStructured([], {}, 1_000)).rejects.toMatchObject({
      status: 400,
    });
    const down = fakeHttp({ status: 500, data: {} });
    await expect(clientWith(down).completeStructured([], {}, 1_000)).rejects.toMatchObject({
      status: 500,
    });
    const broken: HttpPost = {
      async post() {
        throw new Error('socket hang up');
      },
    };
    await expect(clientWith(broken).completeStructured([], {}, 1_000)).rejects.toMatchObject({
      name: 'ProviderTransportError',
      status: null,
    });
  });

  it('streams deltas split across chunks and stops at DONE', async () => {
    const http = fakeHttp({
      status: 200,
      data: chunks([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}',
        '\n\ndata: {"choices":[{"delta":{"content":" there"}}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}\n\n',
        ': ping\n\n',
        'data: [DONE]\n\ndata: {"choices":[{"delta":{"content":"IGNORED"}}]}\n\n',
      ]),
    });
    const client = clientWith(http);
    const events = [];
    for await (const event of client.streamText([{ role: 'user', content: 'hi' }], 12_000)) {
      events.push(event);
    }
    expect(events).toEqual([
      { kind: 'delta', text: 'Hi' },
      { kind: 'delta', text: ' there' },
      { kind: 'usage', tokenUsage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } },
    ]);
    const body = http.last?.body as Record<string, unknown>;
    expect(body.stream).toBe(true);
    expect(body.temperature).toBe(0.2);
    expect(body.response_format).toBeUndefined();
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(http.last?.init.responseType).toBe('stream');
  });

  it('throws when a data line is not json after yielding earlier deltas', async () => {
    const http = fakeHttp({
      status: 200,
      data: chunks(['data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n', 'data: {bad}\n\n']),
    });
    const events = [];
    const stream = clientWith(http).streamText([], 1_000);
    await expect(async () => {
      for await (const event of stream) events.push(event);
    }).rejects.toBeInstanceOf(ProviderTransportError);
    expect(events).toEqual([{ kind: 'delta', text: 'Hi' }]);
  });

  it('does not read a stream when the provider status is not 200', async () => {
    const http = fakeHttp({ status: 429, data: chunks(['data: [DONE]\n\n']) });
    await expect(collect(clientWith(http).streamText([], 1_000))).rejects.toMatchObject({
      status: 429,
    });
  });
});

function clientWith(http: HttpPost) {
  return createOpenRouterClient(http, {
    apiKey: 'sk-test',
    model: 'test-model',
    baseUrl: 'https://openrouter.ai/api/v1/',
  });
}

function fakeHttp(response: { status: number; data: unknown }): HttpPost & {
  last?: { url: string; body: unknown; init: { timeout: number; headers: Record<string, string>; responseType?: string } };
} {
  return {
    async post(url, body, init) {
      this.last = { url, body, init };
      return response;
    },
  };
}

async function* chunks(parts: string[]): AsyncGenerator<string> {
  for (const part of parts) yield part;
}

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const events: T[] = [];
  for await (const event of source) events.push(event);
  return events;
}
