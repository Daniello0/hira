import { MessageRole, UserPlan } from '@hira/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { ChatStore, MessageRecord } from '../chat/chat.store';
import type { MemoryStore } from './memory.store';
import { TurnContextService } from './turn-context.service';
import type { FollowUpJob } from '../search-orchestrator/orchestrate-search';
import type { LlmGateway } from '../search-orchestrator/upstream-gateway';
import type { ProfileService } from '../profile/profile.service';

const CATALOG = { total: 15, byRegion: [], topCities: [], noLocation: 0, remote: 2, foreignRemote: 0, bySource: [] };

function contextService(plan: UserPlan, crossChat = true) {
  const chatActivity = vi.fn(async (_user: string, limit: number) =>
    limit === 0 ? [] : [{ kind: 'chat' as const, title: 'Python', summary: 'Asked about python', queries: ['python'], vacancies: [], at: new Date(2) }],
  );
  const callActivity = vi.fn(async (_user: string, limit: number) =>
    limit === 0 ? [] : [{ kind: 'call' as const, title: null, summary: null, queries: ['remote?'], vacancies: [], at: new Date(1) }],
  );
  const memoryList = vi.fn(async () => []);
  const service = new TurnContextService(
    { findById: async () => ({ id: 'u1', displayName: 'Ada', plan, crossChatMemoryEnabled: crossChat }) } as never,
    { recentActivity: chatActivity } as never,
    { list: memoryList } as never,
    { forPrompt: async () => [] } as never,
    async () => null,
    unused(),
    { get: async () => ({ headline: 'QA', about: null, seniority: null, desiredRoles: [], preferredWorkFormat: [], preferredLocations: [], preferredEmployment: [], salaryExpectationMin: null, currency: null, education: null }), skills: async () => [{ canonicalName: 'Python' }] } as never,
    { warn: () => undefined } as never,
    { list: async () => [{ vacancy: { title: 'Saved', companyName: 'Acme', locationLabel: 'Минск', source: 'GSZ', workFormat: null } }] } as never,
    { recentActivity: callActivity } as never,
    { read: async () => CATALOG } as never,
  );
  return { service, chatActivity, memoryList };
}

const USER = { kind: 'user' as const, userId: 'u1' };

describe('turn facts', () => {
  it('gives a guest the catalog and this chat, and nothing of any account', async () => {
    const { service, chatActivity } = contextService(UserPlan.Max);
    const shownHere = [{ title: 'Shown', company: 'A', city: null, source: 'gsz.gov.by', workFormat: null }];
    const context = await service.load({ caller: { kind: 'demo', demoSessionId: 'd1' }, query: 'q', useMemory: true, summary: null, shownHere });
    expect(context.facts).toEqual({ catalog: CATALOG, profile: null, memory: [], favorites: [], activity: [], shownHere });
    expect(chatActivity).not.toHaveBeenCalled();
  });

  it('gives Pro the profile, favorites, and earlier chats and calls', async () => {
    const { service } = contextService(UserPlan.Pro);
    const { facts } = await service.load({ caller: USER, query: 'q', useMemory: true, summary: null });
    expect(facts?.profile).toMatchObject({ name: 'Ada', headline: 'QA', skills: ['Python'] });
    expect(facts?.favorites).toEqual([{ title: 'Saved', company: 'Acme', city: 'Минск', source: 'gsz.gov.by', workFormat: null }]);
    expect(facts?.activity.map((item) => item.kind)).toEqual(['chat', 'call']);
    expect(facts?.catalog).toEqual(CATALOG);
  });

  it('asks for as many earlier chats as the plan allows, leaving out the open one', async () => {
    const { service, chatActivity } = contextService(UserPlan.Max);
    await service.load({ caller: USER, query: 'q', useMemory: true, summary: null, chatId: 'open' });
    expect(chatActivity).toHaveBeenCalledWith('u1', 50, 'open');
  });

  it('gives Free the profile and favorites, but no earlier chats and no memory', async () => {
    const { service, memoryList } = contextService(UserPlan.Free);
    const { facts, extract } = await service.load({ caller: USER, query: 'q', useMemory: true, summary: null });
    expect(facts?.profile).not.toBeNull();
    expect(facts?.favorites).toHaveLength(1);
    expect(facts?.activity).toEqual([]);
    expect(memoryList).not.toHaveBeenCalled();
    expect(extract).toBe(false);
  });

  it('leaves earlier chats out when cross-chat memory is off, and keeps the profile and favorites', async () => {
    const { service } = contextService(UserPlan.Pro, false);
    const { facts } = await service.load({ caller: USER, query: 'q', useMemory: true, summary: null });
    expect(facts?.activity).toEqual([]);
    expect(facts?.memory).toEqual([]);
    expect(facts?.favorites).toHaveLength(1);
  });

  it('leaves earlier chats out when this turn says not to use memory', async () => {
    const { service } = contextService(UserPlan.Pro);
    const { facts } = await service.load({ caller: USER, query: 'q', useMemory: false, summary: null });
    expect(facts?.activity).toEqual([]);
  });
});

describe('turn follow-up', () => {
  it('logs a summary failure and still extracts facts', async () => {
    const warnings: string[] = [];
    let extracted = false;
    const service = new TurnContextService(
      unused(),
      chats(),
      memories(),
      unused(),
      async () => null,
      llm(() => {
        extracted = true;
      }),
      unused<ProfileService>(),
      { warn: (_details: object, message: string) => warnings.push(message) } as never,
    );
    await service.after(job());
    expect(warnings).toContain('chat summary was left unchanged');
    expect(extracted).toBe(true);
  });

  it('logs a skipped extraction and still finishes', async () => {
    const warnings: string[] = [];
    const gateway = llm(() => undefined);
    gateway.extractMemory = () => Promise.reject(new Error('extract down'));
    gateway.summarize = () => Promise.resolve({ summary: 'Цель поиска: python' });
    const service = new TurnContextService(
      unused(),
      chats(true),
      memories(),
      unused(),
      async () => null,
      gateway,
      unused<ProfileService>(),
      { warn: (_details: object, message: string) => warnings.push(message) } as never,
    );
    await service.after(job());
    expect(warnings).toContain('memory extraction was skipped');
  });
});

function job(): FollowUpJob {
  return {
    extract: true,
    userId: 'user-1',
    chatId: 'chat-1',
    sourceMessageId: 'message-1',
    sourceCallTurnId: null,
    sourceCallSessionId: null,
    previousCount: 14,
    messageCount: 16,
    previousSummary: 'Цель поиска: python',
    exchange: [{ role: MessageRole.User, content: 'remote' }],
  };
}

function chats(save = false): ChatStore {
  const setSummary = save ? () => Promise.resolve() : () => Promise.reject(new Error('summary must stay'));
  return { recentMessages: () => Promise.resolve(history()), setSummary } as unknown as ChatStore;
}

function history(): MessageRecord[] {
  return Array.from({ length: 16 }, (_, index) => ({
    id: String(index),
    chatId: 'chat-1',
    role: index % 2 === 0 ? MessageRole.User : MessageRole.Assistant,
    content: `line ${index}`,
    intent: null,
    diagnostics: null,
    tokenUsage: null,
    createdAt: new Date('2026-10-18T12:00:00.000Z'),
  }));
}

function memories(): MemoryStore {
  return {
    list: () => Promise.resolve([]),
    insert: (fact) => Promise.resolve(fact),
    update: () => Promise.resolve(null),
    revoke: () => Promise.resolve(false),
    revokeAll: () => Promise.resolve(0),
  };
}

function llm(onExtract: () => void): LlmGateway {
  return {
    understand: () => Promise.reject(new Error('unused')),
    generate: async function* () {
      yield { kind: 'token', delta: '' };
    },
    summarize: () => Promise.reject(new Error('llm down')),
    extractMemory: () => {
      onExtract();
      return Promise.resolve({ candidates: [], suggestions: [] });
    },
    parseResume: () => Promise.resolve({ skills: [], experience: [] }),
  };
}

function unused<T>(): T {
  return {} as T;
}
