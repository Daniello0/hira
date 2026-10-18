import { MessageRole } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import type { ChatStore, MessageRecord } from '../chat/chat.store';
import type { MemoryStore } from './memory.store';
import { TurnContextService } from './turn-context.service';
import type { FollowUpJob } from '../search-orchestrator/orchestrate-search';
import type { LlmGateway } from '../search-orchestrator/upstream-gateway';
import type { ProfileService } from '../profile/profile.service';

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
    messageCount: 16,
    previousSummary: 'Цель поиска: python',
    exchange: [{ role: MessageRole.User, content: 'remote' }],
  };
}

function chats(save = false): ChatStore {
  const setSummary = save ? () => Promise.resolve() : () => Promise.reject(new Error('summary must stay'));
  return { chronologicalMessages: () => Promise.resolve(history()), setSummary } as unknown as ChatStore;
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
