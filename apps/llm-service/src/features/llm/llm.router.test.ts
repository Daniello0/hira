import { IntentType, MessageRole, QueryComplexity } from '@hira/contracts';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app';
import { understandCacheKey } from '../cache/understand-cache-key';
import { SEARCH_INTENT_SCHEMA_VERSION } from '../llm/llm.constants';
import { generateAnswer } from '../generate/generate.service';
import { ProviderTransportError } from './llm.errors';
import { createLlmRouter, type LlmRouterDeps } from './llm.router';
import { understandQuery } from '../understand/understand.service';
import { validModelIntent } from '../understand/understand.fixture';

const logger = pino({ level: 'silent' });
const usage = { promptTokens: 3, completionTokens: 4, totalTokens: 7 };
const understandBody = { query: 'remote python', history: [], memory: [] };

describe('llm routes', () => {
  it('keeps health open and rejects a missing internal token', async () => {
    const app = createTestApp(configured());
    expect((await request(app).get('/health')).status).toBe(200);
    const response = await request(app).post('/internal/v1/understand').send(understandBody);
    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe('INTERNAL_TOKEN_INVALID');
  });

  it('answers speak with the sound, and a failure as the shared error', async () => {
    const body = { text: 'Привет', voice: 'ru-RU-Harper:MAI-Voice-2.1-Flash' };
    const speak = vi.fn(async () => Buffer.from('sound'));
    const ok = await request(createTestApp({ ...configured(), speak })).post('/internal/v1/speak').set('X-Internal-Token', 'secret').send(body);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toContain('audio/mpeg');
    expect(ok.body.toString()).toBe('sound');
    const failing = vi.fn(async () => { throw new ProviderTransportError('down'); });
    const down = await request(createTestApp({ ...configured(), speak: failing })).post('/internal/v1/speak').set('X-Internal-Token', 'secret').send(body);
    expect(down.status).toBeGreaterThanOrEqual(500);
    const untouched = vi.fn();
    const bad = await request(createTestApp({ ...configured(), speak: untouched })).post('/internal/v1/speak').set('X-Internal-Token', 'secret').send({ text: '' });
    expect(bad.status).toBe(400);
    expect(untouched).not.toHaveBeenCalled();
  });

  it('returns 503 when the key or the model is missing and does not call the provider', async () => {
    const understand = vi.fn();
    const missingKey = await request(createTestApp({ ...configured(), apiKey: '', understand }))
      .post('/internal/v1/understand')
      .set('X-Internal-Token', 'secret')
      .send(understandBody);
    const missingModel = await request(createTestApp({ ...configured(), model: '', understand }))
      .post('/internal/v1/generate')
      .set('X-Internal-Token', 'secret')
      .send({ intent: publicIntent(), results: [], history: [] });
    expect(missingKey.status).toBe(503);
    expect(missingKey.body.errorCode).toBe('LLM_NOT_CONFIGURED');
    expect(missingModel.status).toBe(503);
    expect(missingModel.body.errorCode).toBe('LLM_NOT_CONFIGURED');
    expect(understand).not.toHaveBeenCalled();
  });

  it('returns 400 for an empty query and reports the request id', async () => {
    const response = await request(createTestApp(configured()))
      .post('/internal/v1/understand')
      .set('X-Internal-Token', 'secret')
      .set('X-Request-Id', 'req-9')
      .send({ query: '   ', history: [], memory: [] });
    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_FAILED');
    expect(response.body.requestId).toBe('req-9');
    expect(response.body.details).toBeDefined();
  });

  it('returns the intent envelope and serves the same query from cache', async () => {
    const rig = rigUnderstand();
    const app = createTestApp(rig.routes);
    const first = await request(app)
      .post('/internal/v1/understand')
      .set('X-Internal-Token', 'secret')
      .set('X-Request-Id', 'req-1')
      .send(understandBody);
    const second = await request(app)
      .post('/internal/v1/understand')
      .set('X-Internal-Token', 'secret')
      .send(understandBody);
    expect(first.status).toBe(200);
    expect(first.headers['x-llm-provider']).toBe('openrouter');
    expect(first.body.intent.skills[0].canonicalId).toBeNull();
    expect(first.body.meta.tokenUsage).toEqual(usage);
    expect(first.body.requestId).toBeUndefined();
    expect(second.body.intent.rewrittenQuery).toBe(first.body.intent.rewrittenQuery);
    expect(rig.provider.calls).toHaveLength(1);
    expect(rig.cache.store.has(understandCacheKey('test-model', SEARCH_INTENT_SCHEMA_VERSION, understandBody))).toBe(true);
  });

  it('returns 422 when the model never produces a valid intent', async () => {
    const rig = rigUnderstand('nope', 'nope', 'nope');
    const response = await request(createTestApp(rig.routes))
      .post('/internal/v1/understand')
      .set('X-Internal-Token', 'secret')
      .send(understandBody);
    expect(response.status).toBe(422);
    expect(response.body.errorCode).toBe('LLM_INVALID_OUTPUT');
    expect(response.headers['x-llm-provider']).toBe('openrouter');
    expect(rig.cache.ttls).toEqual([]);
  });

  it('still answers when redis fails', async () => {
    const rig = rigUnderstand();
    rig.cache.failGet = true;
    rig.cache.failSet = true;
    const response = await request(createTestApp(rig.routes))
      .post('/internal/v1/understand')
      .set('X-Internal-Token', 'secret')
      .send(understandBody);
    expect(response.status).toBe(200);
    expect(response.body.intent.intentType).toBe(IntentType.Search);
  });

  it('streams tokens and does not write the understand cache', async () => {
    const rig = rigGenerate();
    const response = await request(createTestApp(rig.routes))
      .post('/internal/v1/generate')
      .set('X-Internal-Token', 'secret')
      .send({
        intent: publicIntent(),
        history: [{ role: MessageRole.User, content: 'hello' }],
        results: [],
      });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.headers['x-llm-provider']).toBe('openrouter');
    expect(response.text).toContain('event: token');
    expect(response.text).toContain('"delta":"Hello"');
    expect(response.text).toContain('event: done');
    expect(response.text).toContain('"promptTokens":1');
    expect(rig.cache.ttls).toEqual([]);
    expect(rig.provider.calls).toHaveLength(1);
  });

  it('returns 502 json when the stream fails before the first token', async () => {
    const rig = rigGenerate(new ProviderTransportError(500, 'down'));
    const response = await request(createTestApp(rig.routes))
      .post('/internal/v1/generate')
      .set('X-Internal-Token', 'secret')
      .send({ intent: publicIntent(), history: [], results: [] });
    expect(response.status).toBe(502);
    expect(response.body.errorCode).toBe('LLM_UPSTREAM_UNAVAILABLE');
    expect(response.headers['content-type']).toContain('application/json');
    expect(rig.provider.calls).toHaveLength(3);
  });

  it('writes an error event after a token and does not open another stream', async () => {
    const rig = rigGenerate(
      { kind: 'delta', text: 'Hello' },
      new ProviderTransportError(500, 'cut'),
    );
    const response = await request(createTestApp(rig.routes))
      .post('/internal/v1/generate')
      .set('X-Internal-Token', 'secret')
      .set('X-Request-Id', 'req-stream')
      .send({ intent: publicIntent(), history: [], results: [] });
    expect(response.status).toBe(200);
    expect(response.text).toContain('event: token');
    expect(response.text).toContain('event: error');
    expect(response.text).toContain('LLM_UPSTREAM_UNAVAILABLE');
    expect(response.text).toContain('req-stream');
    expect(rig.provider.calls).toHaveLength(1);
  });
});

function createTestApp(deps: LlmRouterDeps) {
  return createApp({
    logger,
    internalToken: 'secret',
    probes: [],
    internalRouter: createLlmRouter(deps),
  });
}

function configured(): LlmRouterDeps {
  return {
    apiKey: 'sk-test',
    model: 'test-model',
    understand: vi.fn(),
    generate: vi.fn(),
    extractSkills: vi.fn(),
    summarize: vi.fn(),
    extractMemory: vi.fn(),
    parseResume: vi.fn(),
    speak: vi.fn(),
  };
}

function publicIntent() {
  return {
    rewrittenQuery: 'remote python',
    role: null,
    skills: [],
    seniority: null,
    hardConstraints: {},
    softConstraints: {},
    complexity: QueryComplexity.Simple,
    intentType: IntentType.Search,
  };
}

function rigUnderstand(...steps: Array<string | Error>) {
  const queue = steps.length === 0 ? [JSON.stringify(validModelIntent())] : [...steps];
  const provider = {
    calls: [] as unknown[],
    async completeStructured(messages: unknown, schema: unknown, timeoutMs: number) {
      this.calls.push({ messages, schema, timeoutMs });
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return { content: next, tokenUsage: usage };
    },
  };
  const cache = memoryCache();
  const routes: LlmRouterDeps = {
    apiKey: 'sk-test',
    model: 'test-model',
    understand: (body) =>
      understandQuery(
        {
          provider,
          cache,
          sleep: async () => undefined,
          model: 'test-model',
          logger,
          now: () => 0,
        },
        body,
      ),
    generate: vi.fn(),
    extractSkills: vi.fn(),
    summarize: vi.fn(),
    extractMemory: vi.fn(),
    parseResume: vi.fn(),
  };
  return { provider, cache, routes };
}

function rigGenerate(...script: Array<{ kind: 'delta' | 'usage'; text?: string } | Error>) {
  const provider = {
    calls: [] as unknown[],
    async *streamText(messages: unknown, timeoutMs: number) {
      this.calls.push({ messages, timeoutMs });
      const events =
        script.length === 0
          ? [
              { kind: 'delta' as const, text: 'Hello' },
              {
                kind: 'usage' as const,
                tokenUsage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
              },
            ]
          : script;
      for (const item of events) {
        if (item instanceof Error) throw item;
        yield item;
      }
    },
  };
  const cache = memoryCache();
  const routes: LlmRouterDeps = {
    apiKey: 'sk-test',
    model: 'test-model',
    understand: vi.fn(),
    generate: (body, emit) =>
      generateAnswer({ provider, sleep: async () => undefined, now: () => 0 }, body, emit),
    extractSkills: vi.fn(),
    summarize: vi.fn(),
    extractMemory: vi.fn(),
    parseResume: vi.fn(),
  };
  return { provider, cache, routes };
}

function memoryCache() {
  const store = new Map<string, string>();
  return {
    store,
    ttls: [] as number[],
    failGet: false,
    failSet: false,
    async get(key: string): Promise<string | null> {
      if (this.failGet) throw new Error('redis down');
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
      this.ttls.push(ttlSeconds);
      if (this.failSet) throw new Error('redis down');
      store.set(key, value);
    },
  };
}
