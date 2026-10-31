import { DocumentKind, MemoryKind, MessageRole, type GenerateRequest, type TurnFacts } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { SSE_EVENT } from '../chat/chat.constants';
import { MemoryChatStore } from '../chat/memory-chat.store';
import type { ChatRecord } from '../chat/chat.store';
import { IntentType } from '@hira/contracts';
import { postCallTurn, postChatMessage, type OrchestratorDeps, type SseSink } from './orchestrate-search';
import { heuristicIntent } from './heuristic-intent';
import { TOKEN_USAGE, retrievalResponse } from './search-fixture';
import type { LlmGateway, LlmGenerateEvent, RetrievalGateway } from './upstream-gateway';
import type { QuotaGate } from './orchestrate-search';

const USER_ID = '33333333-3333-4333-8333-333333333333';

describe('stage 12 turn context', () => {
  it('sends constraints and a pinned file, and starts follow-up after done', async () => {
    const rig = rigFor();
    const sink = new MemorySink();
    const pending: Promise<void>[] = [];
    rig.deps.schedule = (task) => pending.push(task);
    rig.deps.context = {
      load: async () => ({
        summary: 'Цель поиска: python',
        memory: [{ content: 'no relocation' }],
        documents: [{ title: 'CV', kind: DocumentKind.Resume, content: 'python' }],
        extract: true,
      }),
    };
    let sawDone = false;
    rig.deps.followUp = {
      after: async () => {
        sawDone = sink.events.at(-1)?.event === SSE_EVENT.done;
      },
    };
    await postChatMessage(rig.deps, { caller: { kind: 'user', userId: USER_ID }, chat: rig.chat, content: 'remote python', requestId: 'req' }, sink);
    await Promise.all(pending);
    expect(rig.llm.understandCalls[0]?.memory).toEqual([{ content: 'no relocation' }]);
    expect(rig.llm.understandCalls[0]?.documents?.[0]?.title).toBe('CV');
    expect(rig.llm.understandCalls[0]?.summary).toBe('Цель поиска: python');
    expect(JSON.stringify(rig.llm.understandCalls[0]?.memory)).not.toContain('CV');
    expect(sawDone).toBe(true);
    expect(sink.events.at(-1)?.event).toBe(SSE_EVENT.done);
  });

  it('does not put memory on a direct search', async () => {
    const rig = rigFor();
    rig.deps.context = { load: async () => { throw new Error('context should not load'); } };
    const { runDirectSearch } = await import('./orchestrate-search');
    await runDirectSearch(rig.deps, {
      caller: { kind: 'user', userId: USER_ID },
      request: { intent: heuristicIntent('cached'), limit: 10 },
      requestId: 'req',
    });
    expect(rig.llm.understandCalls).toHaveLength(0);
  });

  it('hands the facts to the reply and tells understanding which vacancies the user may mean', async () => {
    const rig = rigFor();
    const facts: TurnFacts = {
      catalog: null,
      profile: null,
      memory: [],
      favorites: [{ title: 'Saved', company: 'Acme', city: null, source: 'gsz.gov.by', workFormat: null }],
      activity: [],
      shownHere: [],
    };
    rig.deps.context = { load: async () => ({ summary: null, memory: [], documents: [], extract: false, facts }) };
    await postChatMessage(rig.deps, { caller: { kind: 'user', userId: USER_ID }, chat: rig.chat, content: 'the saved one', requestId: 'req' }, new MemorySink());
    expect(rig.llm.generateCalls[0]?.facts).toEqual(facts);
    expect(rig.llm.understandCalls[0]).toMatchObject({ knownVacancies: ['Saved (Acme)'] });
  });

  it('lets the next chat turn know what the last one showed, and names the open chat', async () => {
    const rig = rigFor();
    const loads: Array<{ chatId?: string | null; shownHere?: unknown[] }> = [];
    rig.deps.context = {
      load: async (input) => {
        loads.push(input);
        return { summary: null, memory: [], documents: [], extract: false };
      },
    };
    const caller = { kind: 'user' as const, userId: USER_ID };
    await postChatMessage(rig.deps, { caller, chat: rig.chat, content: 'python', requestId: 'r1' }, new MemorySink());
    const chat = (await rig.deps.chats.findChat(rig.chat.id)) ?? rig.chat;
    await postChatMessage(rig.deps, { caller, chat, content: 'which site is it on?', requestId: 'r2' }, new MemorySink());
    expect(loads[0]).toMatchObject({ chatId: rig.chat.id, shownHere: [] });
    expect(loads[1]?.shownHere?.length).toBeGreaterThan(0);
    expect(loads[1]?.shownHere?.[0]).toHaveProperty('source');
  });

  it('keeps a call out of the chat list and spends quota only on search', async () => {
    const rig = rigFor();
    const calls = new MemoryCalls();
    const sink = new MemorySink();
    await postCallTurn(rig.deps, {
      caller: { kind: 'user', userId: USER_ID },
      session: { id: 'call-1', endedAt: null },
      content: 'hello',
      requestId: 'req',
      calls,
    }, sink);
    expect(rig.chats.chats).toHaveLength(1);
    expect(calls.turns).toHaveLength(2);
    expect(calls.turns[1]?.results).toEqual(retrievalResponse().results);
    expect(rig.quota.calls).toBe(1);
    rig.llm.intentType = IntentType.SmallTalk;
    await postCallTurn(rig.deps, {
      caller: { kind: 'user', userId: USER_ID },
      session: { id: 'call-1', endedAt: null },
      content: 'thanks',
      requestId: 'req',
      calls,
    }, new MemorySink());
    expect(rig.quota.calls).toBe(1);
    await expect(postCallTurn(rig.deps, {
      caller: { kind: 'user', userId: USER_ID },
      session: { id: 'call-1', endedAt: new Date() },
      content: 'again',
      requestId: 'req',
      calls,
    }, new MemorySink())).rejects.toThrow(/ended/);
  });
});

function rigFor() {
  const chats = new MemoryChatStore();
  const llm = new FakeLlm();
  const retrieval = new FakeRetrieval();
  const quota = new FakeQuota();
  const chat = {
    id: 'chat-1',
    userId: USER_ID,
    demoSessionId: null,
    title: null,
    summary: null,
    messageCount: 0,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies ChatRecord;
  chats.chats.push(chat);
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

class MemoryCalls {
  turns: Array<{ id: string; role: string; content: string; results: unknown; createdAt: Date }> = [];

  /** Recent turns in insertion order. */
  recentTurns(): Promise<Array<{ id: string; role: string; content: string; createdAt: Date }>> {
    return Promise.resolve(this.turns);
  }

  /** Stores one turn. */
  insertTurn(turn: { id: string; role: string; content: string; results: unknown; createdAt: Date }): Promise<{ id: string; role: string; content: string; createdAt: Date }> {
    this.turns.push(turn);
    return Promise.resolve(turn);
  }
}

class MemorySink implements SseSink {
  events: Array<{ event: string; data: unknown }> = [];
  open(): void { return undefined; }
  write(event: string, data: unknown): void { this.events.push({ event, data }); }
}

class FakeQuota implements QuotaGate {
  calls = 0;
  consumeDemo() { this.calls += 1; return Promise.resolve({ allowed: true, remaining: 1, retryAfterSeconds: null }); }
  consumeRegistered() { this.calls += 1; return Promise.resolve({ allowed: true, remaining: 1, retryAfterSeconds: null }); }
}

class FakeLlm implements LlmGateway {
  intentType = IntentType.Search;
  understandCalls: Array<{ memory?: unknown; documents?: Array<{ title: string }>; summary?: string | null }> = [];
  async understand(request: { query: string; memory?: unknown; documents?: Array<{ title: string }>; summary?: string | null }) {
    this.understandCalls.push(request);
    return { intent: { ...heuristicIntent(request.query), intentType: this.intentType }, meta: { tokenUsage: TOKEN_USAGE } };
  }
  generateCalls: GenerateRequest[] = [];
  async *generate(request: GenerateRequest): AsyncGenerator<LlmGenerateEvent> {
    this.generateCalls.push(request);
    yield { kind: 'token', delta: 'Hi' };
    yield { kind: 'done', tokenUsage: TOKEN_USAGE };
  }
  summarize() { return Promise.resolve({ summary: 'Цель поиска: x' }); }
  extractMemory() { return Promise.resolve({ candidates: [], suggestions: [] }); }
  parseResume() { return Promise.resolve({ skills: [], experience: [] }); }
}

class FakeRetrieval implements RetrievalGateway {
  search() { return Promise.resolve(retrievalResponse()); }
}

void MemoryKind;
void MessageRole;
