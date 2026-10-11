import { IntentType, QueryComplexity, SeniorityLevel, WorkFormat } from '@hira/contracts';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { understandCacheKey } from '../cache/understand-cache-key';
import { LlmOutputError, ProviderTransportError } from '../llm/llm.errors';
import { understandQuery, type UnderstandDeps } from './understand.service';
import { validModelIntent } from './understand.fixture';

const request = { query: 'remote python', history: [], memory: [] };
const usage = { promptTokens: 3, completionTokens: 4, totalTokens: 7 };
const logger = pino({ level: 'silent' });

describe('understandQuery', () => {
  it('returns a search intent and stores it for one day', async () => {
    const provider = scripted(JSON.stringify(validModelIntent()));
    const cache = memoryCache();
    const result = await understandQuery(deps(provider, cache), request);
    expect(result.intent).toMatchObject({
      seniority: SeniorityLevel.Junior,
      hardConstraints: { workFormat: [WorkFormat.Remote], location: ['Minsk'] },
      softConstraints: { medicine: 0.4 },
      complexity: QueryComplexity.Moderate,
      intentType: IntentType.Search,
    });
    expect(result.intent.skills[0]?.canonicalId).toBeNull();
    expect(result.meta.tokenUsage).toEqual(usage);
    expect(cache.ttls).toEqual([86_400]);
    expect(cache.store.has(understandCacheKey('test-model', '1', request))).toBe(true);
    const schema = provider.calls[0]?.schema as { additionalProperties?: boolean };
    expect(schema.additionalProperties).toBe(false);
    expect(provider.calls[0]?.timeoutMs).toBe(7_000);
  });

  it('does not call the provider again for the same input', async () => {
    const provider = scripted(JSON.stringify(validModelIntent()));
    const cache = memoryCache();
    const dependencies = deps(provider, cache);
    await understandQuery(dependencies, request);
    const second = await understandQuery(dependencies, request);
    expect(provider.calls).toHaveLength(1);
    expect(second.intent.rewrittenQuery).toContain('Python');
  });

  it('calls the provider when the model or the query changes', async () => {
    const provider = scripted(
      JSON.stringify(validModelIntent()),
      JSON.stringify(validModelIntent()),
    );
    const cache = memoryCache();
    await understandQuery(deps(provider, cache), request);
    await understandQuery(deps(provider, cache, 'other-model'), request);
    expect(provider.calls).toHaveLength(2);
  });

  it('calls the provider when the cache cannot be read', async () => {
    const provider = scripted(JSON.stringify(validModelIntent()));
    const cache = memoryCache();
    cache.failGet = true;
    const result = await understandQuery(deps(provider, cache), request);
    expect(provider.calls).toHaveLength(1);
    expect(result.intent.role).toBe('Python developer');
  });

  it('calls the provider when the cached payload is not json', async () => {
    const provider = scripted(JSON.stringify(validModelIntent()));
    const cache = memoryCache();
    cache.store.set(understandCacheKey('test-model', '1', request), '{not-json');
    const result = await understandQuery(deps(provider, cache), request);
    expect(provider.calls).toHaveLength(1);
    expect(result.intent.role).toBe('Python developer');
  });

  it('returns the intent when the cache write fails', async () => {
    const provider = scripted(JSON.stringify(validModelIntent()));
    const cache = memoryCache();
    cache.failSet = true;
    const result = await understandQuery(deps(provider, cache), request);
    expect(result.intent.role).toBe('Python developer');
  });

  it('retries an invalid payload and includes the validation error in the next prompt', async () => {
    const provider = scripted('not json', JSON.stringify(validModelIntent()));
    const result = await understandQuery(deps(provider, memoryCache()), request);
    expect(result.intent.intentType).toBe(IntentType.Search);
    expect(provider.calls).toHaveLength(2);
    expect(JSON.stringify(provider.calls[1]?.messages)).toContain('not json');
    expect(provider.sleeps).toEqual([200]);
  });

  it('returns LLM_INVALID_OUTPUT after three invalid payloads and does not cache them', async () => {
    const provider = scripted('nope', 'still nope', 'no');
    const cache = memoryCache();
    await expect(understandQuery(deps(provider, cache), request)).rejects.toMatchObject({
      status: 422,
      errorCode: 'LLM_INVALID_OUTPUT',
    });
    expect(provider.calls).toHaveLength(3);
    expect(cache.ttls).toEqual([]);
  });

  it('retries a transient provider failure and stops on HTTP 400', async () => {
    const provider = scripted(
      new ProviderTransportError(500, 'down'),
      JSON.stringify(validModelIntent()),
    );
    const result = await understandQuery(deps(provider, memoryCache()), request);
    expect(result.meta.tokenUsage).toEqual(usage);
    expect(provider.calls).toHaveLength(2);

    const fatal = scripted(new ProviderTransportError(400, 'rejected'));
    await expect(understandQuery(deps(fatal, memoryCache()), request)).rejects.toMatchObject({
      status: 502,
      errorCode: 'LLM_UPSTREAM_UNAVAILABLE',
    });
    expect(fatal.calls).toHaveLength(1);
  });

  it('returns LLM_UPSTREAM_UNAVAILABLE when every attempt fails in transport', async () => {
    const provider = scripted(
      new ProviderTransportError(429, 'slow'),
      new ProviderTransportError(null, 'reset'),
      new ProviderTransportError(503, 'down'),
    );
    await expect(understandQuery(deps(provider, memoryCache()), request)).rejects.toMatchObject({
      status: 502,
      errorCode: 'LLM_UPSTREAM_UNAVAILABLE',
    });
    expect(provider.calls).toHaveLength(3);
    expect(provider.sleeps).toEqual([200, 800]);
  });

  it('retries a duplicated soft constraint as invalid output', async () => {
    const duplicated = validModelIntent();
    duplicated.softConstraints = [
      { key: 'medicine', weight: 0.2 },
      { key: 'medicine', weight: 0.9 },
    ];
    const provider = scripted(JSON.stringify(duplicated), JSON.stringify(validModelIntent()));
    const result = await understandQuery(deps(provider, memoryCache()), request);
    expect(result.intent.softConstraints).toEqual({ medicine: 0.4 });
    expect(JSON.stringify(provider.calls[1]?.messages)).toContain('duplicate soft constraint');
  });
});

function deps(
  provider: ReturnType<typeof scripted>,
  cache: ReturnType<typeof memoryCache>,
  model = 'test-model',
): UnderstandDeps {
  return {
    provider,
    cache,
    sleep: provider.sleep,
    model,
    logger,
    now: () => 0,
  };
}

function scripted(...steps: Array<string | Error>) {
  const queue = [...steps];
  const calls: Array<{ messages: unknown; schema: unknown; timeoutMs: number }> = [];
  const sleeps: number[] = [];
  return {
    calls,
    sleeps,
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
    async completeStructured(messages: unknown, schema: unknown, timeoutMs: number) {
      calls.push({ messages, schema, timeoutMs });
      const next = queue.shift();
      if (next instanceof Error) throw next;
      if (next === undefined) throw new LlmOutputError('missing script');
      return { content: next, tokenUsage: usage };
    },
  };
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
