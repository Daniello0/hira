import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { MessageRole, PLAN_LIMITS, UserPlan, type PromptTurn, type TurnFacts } from '@hira/contracts';
import type { Logger } from 'pino';
import { LOGGER } from '../../common/constants/app.constants';
import { USER_STORE, type Account, type UserStore } from '../auth/user.store';
import { CALL_STORE, type CallStore } from '../call/call.store';
import { CatalogStatsService } from '../catalog/catalog-stats.service';
import { FAVORITE_STORE, type FavoriteStore } from '../favorite/favorite.store';
import { CHAT_STORE, type ChatStore, type MessageRecord } from '../chat/chat.store';
import type { Caller } from '../chat/resolve-actor';
import { LIBRARY_STORE, TEXT_EMBEDDER, type LibraryStore } from '../library/library.store';
import { FACTS_MAX_CHARS, fitFacts, mergeActivity, promptFavorite, promptProfile, type ActivityRecord } from './account-activity';
import { applyMemoryCandidates } from './apply-candidates';
import { assembleTurnContext, type TurnContext } from './assemble-context';
import { enqueueUser } from './follow-up-queue';
import { MEMORY_STORE, type MemoryStore } from './memory.store';
import type { MemoryFact } from './memory.types';
import { isPromptLive } from './select-memory';
import { shouldSummarize, summarySource } from './summarize-when';
import { DOCUMENT_NEIGHBOR_LIMIT, SUMMARY_SOURCE_LIMIT } from './memory.constants';
import { WORKING_WINDOW_SIZE } from '../chat/chat.constants';
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
    @Inject(FAVORITE_STORE) private readonly favorites: FavoriteStore,
    @Inject(CALL_STORE) private readonly calls: CallStore,
    @Inject(CatalogStatsService) private readonly catalog: CatalogStatsService,
  ) {}

  /** Facts, files, the chat summary, and what Hira knows about the catalog and the caller, for one turn. */
  async load(input: ContextLoad): Promise<TurnContext> {
    const catalog = await this.catalog.read();
    if (input.caller.kind !== 'user') {
      const closed = await this.closed(input.summary);
      return { ...closed, facts: guestFacts(catalog, input) };
    }
    const userId = input.caller.userId;
    const account = await this.users.findById(userId);
    const limits = PLAN_LIMITS[account?.plan ?? UserPlan.Free];
    const enabled = (account?.crossChatMemoryEnabled ?? false) && limits.crossChatMemory;
    const facts = enabled && input.useMemory ? await this.memories.list(userId) : [];
    const queryVector = await this.embed(input.query);
    const documents = await this.library.forPrompt(userId, queryVector, DOCUMENT_NEIGHBOR_LIMIT);
    const context = assembleTurnContext({
      enabled,
      useMemory: input.useMemory,
      summary: input.summary,
      facts,
      documents: documents.map((document) => ({
        title: document.title,
        kind: document.kind,
        content: document.extractedText,
        isPinned: document.isPinned,
      })),
      queryVector,
      now: new Date(),
    });
    const chats = enabled && input.useMemory ? limits.contextChats : 0;
    return { ...context, facts: await this.accountFacts(account, userId, chats, context, input, catalog) };
  }

  private async accountFacts(
    account: Account | null,
    userId: string,
    chats: number,
    context: TurnContext,
    input: ContextLoad,
    catalog: TurnFacts['catalog'],
  ): Promise<TurnFacts> {
    const [profile, skills, favorites, chatRows, callRows] = await Promise.all([
      this.safely('profile', () => this.profiles.get(userId), null),
      this.safely('profile skills', () => this.profiles.skills(userId), []),
      this.safely('favorites', () => this.favorites.list(userId, {}), []),
      this.safely<ActivityRecord[]>('earlier chats', () => this.chats.recentActivity(userId, chats, input.chatId ?? null), []),
      this.safely<ActivityRecord[]>('earlier calls', () => this.calls.recentActivity(userId, chats, input.callSessionId ?? null), []),
    ]);
    return fitFacts(
      {
        catalog,
        profile: profile === null ? null : promptProfile(account?.displayName ?? null, profile, skills),
        memory: context.memory,
        favorites: favorites.map(promptFavorite),
        activity: mergeActivity(chatRows, callRows, chats),
        shownHere: input.shownHere ?? [],
      },
      FACTS_MAX_CHARS,
    );
  }

  /** A source of facts that fails leaves a gap. It never stops the reply. */
  private async safely<T>(what: string, read: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await read();
    } catch (error) {
      this.logger.warn({ err: error }, `could not read ${what} for the prompt`);
      return fallback;
    }
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
    if (job.chatId === null || !shouldSummarize(job.previousCount, job.messageCount)) return;
    try {
      const recent = await this.chats.recentMessages(job.chatId, WORKING_WINDOW_SIZE + SUMMARY_SOURCE_LIMIT);
      const messages = summarySource(recent, job.previousSummary).map(toTurn);
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
      sourceChatId: job.chatId,
      sourceCallSessionId: job.sourceCallSessionId,
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

/** A guest has no account data: only the catalog and what this chat showed. */
function guestFacts(catalog: TurnFacts['catalog'], input: ContextLoad): TurnFacts {
  return { catalog, profile: null, memory: [], favorites: [], activity: [], shownHere: input.shownHere ?? [] };
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
