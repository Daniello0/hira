import { IntentType, MessageRole, QueryComplexity, type SearchIntent } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { ProviderTransportError, StreamInterruptedError } from '../llm/llm.errors';
import { generateAnswer, type GenerateDeps, type LlmStreamEvent } from './generate.service';

const usage = { promptTokens: 1, completionTokens: 2, totalTokens: 3 };
const request = {
  intent: intent(),
  history: [{ role: MessageRole.User, content: 'hello' }],
  results: [],
};

describe('generateAnswer', () => {
  it('emits tokens and then usage', async () => {
    const provider = new FakeStream();
    provider.scripts.push([
      { kind: 'delta', text: 'Hello' },
      { kind: 'delta', text: '' },
      { kind: 'usage', tokenUsage: usage },
    ]);
    const events: LlmStreamEvent[] = [];
    await generateAnswer(deps(provider), request, (event) => events.push(event));
    expect(events).toEqual([
      { name: 'token', data: { delta: 'Hello' } },
      { name: 'done', data: { meta: { tokenUsage: usage } } },
    ]);
    expect(provider.calls[0]?.timeoutMs).toBe(20_000);
    expect(JSON.stringify(provider.calls[0]?.messages)).toContain('No vacancies were retrieved.');
  });

  it('retries before the first token and shrinks the next timeout', async () => {
    const provider = new FakeStream();
    provider.scripts.push([new ProviderTransportError(500, 'down')]);
    provider.scripts.push([
      { kind: 'delta', text: 'ok' },
      { kind: 'usage', tokenUsage: usage },
    ]);
    let clock = 1_000;
    provider.onThrow = () => {
      clock += 15_000;
    };
    const events: LlmStreamEvent[] = [];
    await generateAnswer(deps(provider, () => clock, 1_000), request, (event) => events.push(event));
    expect(events[0]).toEqual({ name: 'token', data: { delta: 'ok' } });
    expect(provider.calls.map((call) => call.timeoutMs)).toEqual([20_000, 5_000]);
    expect(provider.sleeps).toEqual([200]);
  });

  it('does not open a second stream after a token has been emitted', async () => {
    const provider = new FakeStream();
    provider.scripts.push([
      { kind: 'delta', text: 'Hello' },
      new ProviderTransportError(500, 'cut'),
    ]);
    const events: LlmStreamEvent[] = [];
    await expect(
      generateAnswer(deps(provider), request, (event) => events.push(event)),
    ).rejects.toBeInstanceOf(StreamInterruptedError);
    expect(events).toEqual([{ name: 'token', data: { delta: 'Hello' } }]);
    expect(provider.calls).toHaveLength(1);
    expect(provider.sleeps).toEqual([]);
  });

  it('fails the call when the budget is spent before another attempt', async () => {
    const provider = new FakeStream();
    provider.scripts.push([new ProviderTransportError(500, 'slow')]);
    let clock = 0;
    provider.onThrow = () => {
      clock = 20_000;
    };
    await expect(
      generateAnswer(deps(provider, () => clock, 0), request, () => undefined),
    ).rejects.toMatchObject({ status: 502, errorCode: 'LLM_UPSTREAM_UNAVAILABLE' });
    expect(provider.calls).toHaveLength(1);
    expect(provider.sleeps).toEqual([200]);
  });
});

function intent(): SearchIntent {
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

function deps(provider: FakeStream, now: () => number = () => 0, startedAtMs = 0): GenerateDeps {
  return { provider, sleep: (ms) => provider.sleep(ms), now, startedAtMs };
}

interface ScriptItem {
  kind: 'delta' | 'usage';
  text?: string;
  tokenUsage?: typeof usage;
}

class FakeStream {
  readonly scripts: Array<Array<ScriptItem | Error>> = [];
  readonly calls: Array<{ messages: unknown; timeoutMs: number }> = [];
  readonly sleeps: number[] = [];
  onThrow: () => void = () => undefined;

  async sleep(ms: number): Promise<void> {
    this.sleeps.push(ms);
  }

  async *streamText(messages: unknown, timeoutMs: number): AsyncGenerator<ScriptItem> {
    this.calls.push({ messages, timeoutMs });
    const script = this.scripts.shift() ?? [];
    for (const item of script) {
      if (item instanceof Error) {
        this.onThrow();
        throw item;
      }
      yield item;
    }
  }
}
