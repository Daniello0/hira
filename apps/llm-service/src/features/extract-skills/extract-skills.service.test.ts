import { SkillImportance, SkillType } from '@hira/contracts';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { extractSkillsCacheKey } from '../cache/extract-skills-cache-key';
import { LlmOutputError, ProviderTransportError } from '../llm/llm.errors';
import { extractSkills, type ExtractSkillsDeps } from './extract-skills.service';

const vacancy = { id: 'v1', title: 'Backend', description: 'нужен Python' };
const usage = { promptTokens: 2, completionTokens: 3, totalTokens: 5 };
const logger = pino({ level: 'silent' });

function modelSkill(...ids: string[]): string {
  const skills = [
    {
      surface: 'Python',
      skillType: SkillType.Hard,
      importance: SkillImportance.Required,
      evidenceSpan: 'Python',
      weight: 0.7,
    },
  ];
  return JSON.stringify({ results: (ids.length === 0 ? ['v1'] : ids).map((id) => ({ id, skills })) });
}

describe('extractSkills', () => {
  it('returns one result per vacancy and caches by the description', async () => {
    const provider = scripted(modelSkill());
    const cache = memoryCache();
    const result = await extractSkills(deps(provider, cache), { vacancies: [vacancy] });
    expect(result.results).toEqual([
      {
        id: 'v1',
        skills: [
          {
            surface: 'Python',
            skillType: SkillType.Hard,
            importance: SkillImportance.Required,
            evidenceSpan: 'Python',
            weight: 0.7,
          },
        ],
      },
    ]);
    expect(cache.ttls).toEqual([86_400]);
    expect(cache.store.has(extractSkillsCacheKey('test-model', '1', vacancy))).toBe(true);
    const schema = provider.calls[0]?.schema as { additionalProperties?: boolean };
    expect(schema.additionalProperties).toBe(false);
    expect(provider.calls[0]?.timeoutMs).toBe(25_000);
    expect(provider.calls[0]?.maxTokens).toBe(1_500);

    const second = await extractSkills(deps(provider, cache), {
      vacancies: [{ ...vacancy, id: 'v2' }],
    });
    expect(provider.calls).toHaveLength(1);
    expect(second.results[0]?.id).toBe('v2');
  });

  it('sends uncached vacancies to the model in batches of five', async () => {
    const ids = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'];
    const provider = scripted(modelSkill('v1', 'v2', 'v3', 'v4', 'v5'), modelSkill('v6'));
    const result = await extractSkills(deps(provider, memoryCache()), {
      vacancies: ids.map((id) => ({ ...vacancy, id, description: `нужен Python ${id}` })),
    });
    expect(provider.calls).toHaveLength(2);
    expect(result.results.map((item) => item.id)).toEqual(ids);
    expect(result.results.every((item) => item.skills.length === 1)).toBe(true);
  });

  it('retries when the model leaves out a vacancy id', async () => {
    const provider = scripted(modelSkill('other'), modelSkill());
    const result = await extractSkills(deps(provider, memoryCache()), { vacancies: [vacancy] });
    expect(provider.calls).toHaveLength(2);
    expect(result.results[0]?.skills).toHaveLength(1);
  });

  it('retries an invalid payload and stops after three failures without caching', async () => {
    const provider = scripted('nope', modelSkill());
    const result = await extractSkills(deps(provider, memoryCache()), { vacancies: [vacancy] });
    expect(result.results[0]?.skills[0]?.surface).toBe('Python');
    expect(provider.calls).toHaveLength(2);

    const cache = memoryCache();
    const failing = scripted('nope', 'nope', 'nope');
    await expect(
      extractSkills(deps(failing, cache), { vacancies: [vacancy] }),
    ).rejects.toMatchObject({
      status: 422,
      errorCode: 'LLM_INVALID_OUTPUT',
    });
    expect(failing.calls).toHaveLength(3);
    expect(cache.ttls).toEqual([]);
  });

  it('retries transport failures, stops on HTTP 400, and still answers when redis fails', async () => {
    const provider = scripted(new ProviderTransportError(500, 'down'), modelSkill());
    const result = await extractSkills(deps(provider, memoryCache()), { vacancies: [vacancy] });
    expect(result.results[0]?.id).toBe('v1');
    expect(provider.calls).toHaveLength(2);

    const fatal = scripted(new ProviderTransportError(400, 'rejected'));
    await expect(
      extractSkills(deps(fatal, memoryCache()), { vacancies: [vacancy] }),
    ).rejects.toMatchObject({ status: 502, errorCode: 'LLM_UPSTREAM_UNAVAILABLE' });
    expect(fatal.calls).toHaveLength(1);

    const cache = memoryCache();
    cache.failGet = true;
    cache.failSet = true;
    const live = scripted(modelSkill());
    const answered = await extractSkills(deps(live, cache), { vacancies: [vacancy] });
    expect(answered.results[0]?.skills).toHaveLength(1);
  });
});

function deps(
  provider: ReturnType<typeof scripted>,
  cache: ReturnType<typeof memoryCache>,
): ExtractSkillsDeps {
  return {
    provider,
    cache,
    sleep: async () => undefined,
    model: 'test-model',
    logger,
    now: () => 0,
  };
}

function scripted(...steps: Array<string | Error>) {
  const queue = [...steps];
  return {
    calls: [] as Array<{ messages: unknown; schema: unknown; timeoutMs: number; maxTokens?: number }>,
    async completeStructured(messages: unknown, schema: unknown, timeoutMs: number, maxTokens?: number) {
      this.calls.push({ messages, schema, timeoutMs, maxTokens });
      const next = queue.shift();
      if (next instanceof Error) throw next;
      if (next === undefined) throw new LlmOutputError('empty script');
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
