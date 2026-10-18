import { IntentType, type GenerateRequest, type RetrievalRequest, type UnderstandRequest, type UnderstandResponse } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { SSE_EVENT } from '../chat/chat.constants';
import { QuotaDeniedError, SearchUpstreamError } from '../chat/chat.errors';
import { MemoryChatStore } from '../chat/memory-chat.store';
import type { ChatRecord } from '../chat/chat.store';
import type { Caller } from '../chat/resolve-actor';
import { heuristicIntent } from './heuristic-intent';
import { postChatMessage, runDirectSearch, type OrchestratorDeps, type QuotaGate, type SseSink } from './orchestrate-search';
import { TOKEN_USAGE, retrievalResponse } from './search-fixture';
import type { LlmGateway, LlmGenerateEvent, RetrievalGateway } from './upstream-gateway';

const REQUEST_ID = 'req-search';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const DEMO_SESSION = '11111111-1111-4111-8111-111111111111';

describe('search turn', () => {
  it('streams intent, cards, and tokens, then stores the turn and clips the title', async () => {
    const rig = await createRig();
    const sink = new MemorySink();
    await postChatMessage(rig.deps, message(rig.chat, 'remote python'), sink);

    expect(sink.events.map((event) => event.event)).toEqual([
      SSE_EVENT.userMessage,
      SSE_EVENT.intent,
      SSE_EVENT.results,
      SSE_EVENT.token,
      SSE_EVENT.assistantMessage,
      SSE_EVENT.done,
    ]);
    expect(sink.events[1]?.data).toMatchObject({ role: 'python' });
    expect(rig.chat.title).toBe('remote python');
    expect(rig.chat.messageCount).toBe(2);
    expect(rig.chats.vacancies).toHaveLength(1);
    expect(rig.chats.searchLogs[0]).toMatchObject({ messageId: rig.chats.messages[0]?.id, rawQuery: 'remote python' });
    expect(rig.retrieval.calls[0]?.userId).toBe(USER_ID);
    expect(rig.retrieval.calls[0]?.limit).toBeUndefined();
    expect(rig.llm.understandCalls[0]?.memory).toEqual([]);
    expect(rig.quota.calls).toBe(1);
  });

  it('shows the previous turn to the same chat and does not retitle it', async () => {
    const rig = await createRig();
    await postChatMessage(rig.deps, message(rig.chat, 'remote python'), new MemorySink());
    await postChatMessage(rig.deps, message(rig.chat, 'only minsk'), new MemorySink());
    const second = rig.llm.understandCalls[1];
    expect(second?.memory).toEqual([]);
    expect(second?.history.map((turn) => turn.content)).toEqual(['remote python', 'Hi']);
    const generated = rig.llm.generateCalls[1] as GenerateRequest;
    expect(generated.history.map((turn) => turn.content)).toEqual(['remote python', 'Hi']);
    expect(rig.chat.title).toBe('remote python');
  });

  it('searches with a heuristic intent when understanding fails', async () => {
    const rig = await createRig();
    rig.llm.understandError = new Error('down');
    const sink = new MemorySink();
    await postChatMessage(rig.deps, message(rig.chat, 'remote python'), sink);
    expect(sink.events[1]?.data).toEqual(heuristicIntent('remote python'));
    expect(rig.retrieval.calls).toHaveLength(1);
  });

  it('does not search or spend quota on small talk', async () => {
    const rig = await createRig();
    rig.llm.intentType = IntentType.SmallTalk;
    const sink = new MemorySink();
    await postChatMessage(rig.deps, message(rig.chat, 'hello'), sink);
    expect(rig.retrieval.calls).toHaveLength(0);
    expect(rig.quota.calls).toBe(0);
    expect(sink.events.map((event) => event.event)).toContain(SSE_EVENT.results);
    expect(sink.events.map((event) => event.event)).toContain(SSE_EVENT.done);
  });

  it('returns cards without an error event when generation fails', async () => {
    const rig = await createRig();
    rig.llm.generateError = new Error('down');
    const sink = new MemorySink();
    await postChatMessage(rig.deps, message(rig.chat, 'remote python'), sink);
    expect(sink.events.map((event) => event.event)).not.toContain(SSE_EVENT.error);
    expect(sink.events.map((event) => event.event)).toContain(SSE_EVENT.done);
    expect(rig.chats.messages[1]?.content).toBe('');
    expect(rig.chats.vacancies).toHaveLength(1);
  });

  it('emits a search error after the intent when retrieval is down and keeps the quota spent', async () => {
    const rig = await createRig();
    rig.retrieval.error = new SearchUpstreamError();
    const sink = new MemorySink();
    await postChatMessage(rig.deps, message(rig.chat, 'remote python'), sink);
    expect(sink.opened).toBe(true);
    expect(sink.events.map((event) => event.event)).toEqual([SSE_EVENT.userMessage, SSE_EVENT.intent, SSE_EVENT.error]);
    expect(sink.events[2]?.data).toMatchObject({ errorCode: 'SEARCH_UPSTREAM_UNAVAILABLE' });
    expect(rig.chats.messages).toHaveLength(1);
    expect(rig.quota.calls).toBe(1);
    expect(rig.chats.vacancies).toHaveLength(0);
  });

  it('emits a quota error inside the stream and does not call retrieval', async () => {
    const rig = await createRig();
    rig.quota.allowed = false;
    const sink = new MemorySink();
    await postChatMessage(rig.deps, message(rig.chat, 'remote python'), sink);
    expect(sink.events.at(-1)).toMatchObject({ event: SSE_EVENT.error });
    expect(sink.events.at(-1)?.data).toMatchObject({ errorCode: 'RATE_LIMIT_EXCEEDED', details: { retryAfterSeconds: 5 } });
    expect(rig.retrieval.calls).toHaveLength(0);
    expect(rig.chats.messages).toHaveLength(1);
  });

  it('forwards a cached intent without understanding and omits a demo user id', async () => {
    const rig = await createRig();
    const intent = heuristicIntent('cached');
    const response = await runDirectSearch(rig.deps, {
      caller: { kind: 'demo', demoSessionId: DEMO_SESSION },
      request: { intent, limit: 10, options: { rerank: false } },
      requestId: REQUEST_ID,
    });
    expect(rig.llm.understandCalls).toHaveLength(0);
    expect(rig.retrieval.calls[0]?.userId).toBeUndefined();
    expect(rig.retrieval.calls[0]?.options).toEqual({ rerank: false });
    expect(response.results).toHaveLength(1);
    expect(rig.chats.searchLogs[0]).toMatchObject({ messageId: null, userId: null, rawQuery: 'cached' });
  });

  it('rejects a direct search before retrieval when the quota is spent', async () => {
    const rig = await createRig();
    rig.quota.allowed = false;
    await expect(
      runDirectSearch(rig.deps, {
        caller: user(),
        request: { intent: heuristicIntent('cached'), limit: 10 },
        requestId: REQUEST_ID,
      }),
    ).rejects.toBeInstanceOf(QuotaDeniedError);
    expect(rig.retrieval.calls).toHaveLength(0);
  });
});

function user(): Caller {
  return { kind: 'user', userId: USER_ID };
}

function message(chat: ChatRecord, content: string) {
  return { caller: user(), chat, content, requestId: REQUEST_ID };
}

async function createRig() {
  const chats = new MemoryChatStore();
  const llm = new FakeLlm();
  const retrieval = new FakeRetrieval();
  const quota = new FakeQuota();
  const chat = await chats.insertChat({ userId: USER_ID });
  const deps: OrchestratorDeps = {
    chats,
    llm,
    retrieval,
    quota,
    logger: { warn: () => undefined },
    now: () => 1_000,
  };
  return { chats, llm, retrieval, quota, chat, deps };
}

class MemorySink implements SseSink {
  opened = false;
  events: Array<{ event: string; data: unknown }> = [];

  /** @inheritdoc */
  open(): void {
    this.opened = true;
  }

  /** @inheritdoc */
  write(event: string, data: unknown): void {
    this.events.push({ event, data });
  }
}

class FakeQuota implements QuotaGate {
  allowed = true;
  calls = 0;

  /** @inheritdoc */
  consumeDemo(): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number | null }> {
    this.calls += 1;
    return Promise.resolve({ allowed: this.allowed, remaining: 0, retryAfterSeconds: null });
  }

  /** @inheritdoc */
  consumeRegistered(): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number | null }> {
    this.calls += 1;
    return Promise.resolve({ allowed: this.allowed, remaining: 0, retryAfterSeconds: this.allowed ? null : 5 });
  }
}

class FakeLlm implements LlmGateway {
  understandError: Error | null = null;
  generateError: Error | null = null;
  intentType = IntentType.Search;
  understandCalls: UnderstandRequest[] = [];
  generateCalls: GenerateRequest[] = [];

  /** @inheritdoc */
  async understand(request: UnderstandRequest): Promise<UnderstandResponse> {
    this.understandCalls.push(request);
    if (this.understandError !== null) throw this.understandError;
    return {
      intent: { ...heuristicIntent(request.query), role: 'python', intentType: this.intentType },
      meta: { tokenUsage: TOKEN_USAGE },
    };
  }

  /** @inheritdoc */
  async *generate(request: GenerateRequest): AsyncGenerator<LlmGenerateEvent> {
    this.generateCalls.push(request);
    if (this.generateError !== null) throw this.generateError;
    yield { kind: 'token', delta: 'Hi' };
    yield { kind: 'done', tokenUsage: TOKEN_USAGE };
  }

  /** @inheritdoc */
  summarize(): Promise<{ summary: string }> {
    return Promise.resolve({ summary: '' });
  }

  /** @inheritdoc */
  extractMemory(): Promise<{ candidates: []; suggestions: [] }> {
    return Promise.resolve({ candidates: [], suggestions: [] });
  }

  /** @inheritdoc */
  parseResume(): Promise<{ skills: []; experience: [] }> {
    return Promise.resolve({ skills: [], experience: [] });
  }
}

class FakeRetrieval implements RetrievalGateway {
  error: Error | null = null;
  calls: RetrievalRequest[] = [];

  /** @inheritdoc */
  async search(request: RetrievalRequest) {
    this.calls.push(request);
    if (this.error !== null) throw this.error;
    return retrievalResponse();
  }
}
