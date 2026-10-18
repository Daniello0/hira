import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { MessageRole, type PromptTurn } from '@hira/contracts';
import type { Logger } from 'pino';
import { LOGGER } from '../../common/constants/app.constants';
import { USER_STORE, type UserStore } from '../auth/user.store';
import { CHAT_STORE, type ChatStore, type MessageRecord } from '../chat/chat.store';
import type { Caller } from '../chat/resolve-actor';
import { LIBRARY_STORE, TEXT_EMBEDDER, type LibraryStore } from '../library/library.store';
import { applyMemoryCandidates } from './apply-candidates';
import { assembleTurnContext, type TurnContext } from './assemble-context';
import { enqueueUser } from './follow-up-queue';
import { MEMORY_STORE, type MemoryStore } from './memory.store';
import type { MemoryFact } from './memory.types';
import { isPromptLive } from './select-memory';
import { outsideWindow, shouldSummarize } from './summarize-when';
import type { ContextLoad, FollowUpJob } from '../search-orchestrator/orchestrate-search';
import { LLM_GATEWAY } from '../search-orchestrator/search.constants';
import type { LlmGateway } from '../search-orchestrator/upstream-gateway';
import { ProfileService } from '../profile/profile.service';

/** Loads prompt context and writes the summary and facts after `done`. */
@Injectable()
export class TurnContextService {
  constructor(
    @Inject(USER_STORE) private readonly users: UserStore,
    @Inject(CHAT_STORE) private readonly chats: ChatStore,
    @Inject(MEMORY_STORE) private readonly memories: MemoryStore,
    @Inject(LIBRARY_STORE) private readonly library: LibraryStore,
    @Inject(TEXT_EMBEDDER) private readonly embed: (text: string) => Promise<number[] | null>,
    @Inject(LLM_GATEWAY) private readonly llm: LlmGateway,
    @Inject(ProfileService) private readonly profiles: ProfileService,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /** Facts, files, and the chat summary for one turn. */
  async load(input: ContextLoad): Promise<TurnContext> {
    if (input.caller.kind !== 'user') return this.closed(input.summary);
    const account = await this.users.findById(input.caller.userId);
    const enabled = account?.crossChatMemoryEnabled ?? false;
    const documents = await this.library.list(input.caller.userId);
    const facts = enabled && input.useMemory ? await this.memories.list(input.caller.userId) : [];
    const queryVector = await this.embed(input.query);
    return assembleTurnContext({
      enabled,
      useMemory: input.useMemory,
      summary: input.summary,
      facts,
      documents: documents.map((document) => ({
        title: document.title,
        kind: document.kind,
        content: document.extractedText,
        isPinned: document.isPinned,
        embedding: document.embedding,
      })),
      queryVector,
      now: new Date(),
    });
  }

  /** Summary and fact extraction. A failure is logged and does not cancel the other step. */
  async after(job: FollowUpJob): Promise<void> {
    const run = () => this.tail(job);
    if (job.userId === null) {
      await run();
      return;
    }
    await enqueueUser(job.userId, run);
  }

  private async tail(job: FollowUpJob): Promise<void> {
    await this.safeSummarize(job);
    await this.safeExtract(job);
  }

  private async safeSummarize(job: FollowUpJob): Promise<void> {
    if (job.chatId === null || !shouldSummarize(job.messageCount)) return;
    try {
      const messages = outsideWindow(await this.chats.chronologicalMessages(job.chatId)).map(toTurn);
      if (messages.length === 0) return;
      const response = await this.llm.summarize({ previousSummary: job.previousSummary, messages }, job.chatId);
      await this.chats.setSummary(job.chatId, response.summary);
    } catch (error) {
      this.logger.warn({ err: error, chatId: job.chatId }, 'chat summary was left unchanged');
    }
  }

  private async safeExtract(job: FollowUpJob): Promise<void> {
    if (!job.extract || job.userId === null) return;
    try {
      await this.extract(job, job.userId);
    } catch (error) {
      this.logger.warn({ err: error, userId: job.userId }, 'memory extraction was skipped');
    }
  }

  private async extract(job: FollowUpJob, userId: string): Promise<void> {
    const before = await this.memories.list(userId);
    const now = new Date();
    const live = before.filter((fact) => isPromptLive(fact, now));
    const response = await this.llm.extractMemory(
      { messages: job.exchange, existingMemory: live.map((fact) => ({ id: fact.id, kind: fact.kind, content: fact.content })) },
      job.sourceMessageId ?? job.sourceCallTurnId ?? userId,
    );
    const after = await applyMemoryCandidates(before, response.candidates, {
      now,
      userId,
      sourceMessageId: job.sourceMessageId,
      sourceCallTurnId: job.sourceCallTurnId,
      nextId: () => randomUUID(),
      embed: (content) => this.embed(content),
    });
    await syncFacts(this.memories, before, after);
    await this.profiles.offerExtracted(userId, response.suggestions, job.sourceMessageId, job.sourceCallTurnId);
  }

  private closed(summary: string | null): Promise<TurnContext> {
    return Promise.resolve(assembleTurnContext({
      enabled: false,
      useMemory: false,
      summary,
      facts: [],
      documents: [],
      queryVector: null,
      now: new Date(),
    }));
  }
}

function toTurn(message: MessageRecord): PromptTurn {
  const role = message.role === MessageRole.Assistant ? MessageRole.Assistant : MessageRole.User;
  return { role, content: message.content };
}

async function syncFacts(store: MemoryStore, before: readonly MemoryFact[], after: readonly MemoryFact[]): Promise<void> {
  const known = new Map(before.map((fact) => [fact.id, fact]));
  for (const fact of after) {
    const previous = known.get(fact.id);
    if (previous === undefined) {
      await store.insert(fact);
      continue;
    }
    if (sameFact(previous, fact)) continue;
    await store.update(fact.id, fact.userId, fact);
  }
}

function sameFact(left: MemoryFact, right: MemoryFact): boolean {
  return left.content === right.content && left.revokedAt?.getTime() === right.revokedAt?.getTime() && left.kind === right.kind && left.confidence === right.confidence;
}

export type { Caller };
