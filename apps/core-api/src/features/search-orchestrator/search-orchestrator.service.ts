import { Inject, Injectable } from '@nestjs/common';
import type { Logger } from 'pino';
import { LOGGER } from '../../common/constants/app.constants';
import { CLOCK, type Clock } from '../../common/utils/clock';
import { PlanGate } from '../billing/plan-gate';
import { CHAT_STORE, type ChatStore } from '../chat/chat.store';
import { CALL_STORE, type CallStore } from '../call/call.store';
import { LibraryService } from '../library/library.service';
import { TurnContextService } from '../memory/turn-context.service';
import { SearchQuotaService } from '../rate-limit/search-quota.service';
import {
  postCallTurn,
  postChatMessage,
  runDirectSearch,
  type CallTurnInput,
  type DirectSearchInput,
  type OrchestratorDeps,
  type PostMessageInput,
  type QuotaGate,
  type SseSink,
} from './orchestrate-search';
import { LLM_GATEWAY, RETRIEVAL_GATEWAY } from './search.constants';
import type { LlmGateway, RetrievalGateway } from './upstream-gateway';
import type { RetrievalResponse } from '@hira/contracts';

/** Nest wrapper around the search turn. Upstream clients and the quota counter are injected. */
@Injectable()
export class SearchOrchestratorService {
  private idle: Promise<void> = Promise.resolve();

  constructor(
    @Inject(CHAT_STORE) private readonly chats: ChatStore,
    @Inject(CALL_STORE) private readonly calls: CallStore,
    @Inject(LLM_GATEWAY) private readonly llm: LlmGateway,
    @Inject(RETRIEVAL_GATEWAY) private readonly retrieval: RetrievalGateway,
    @Inject(SearchQuotaService) private readonly quota: SearchQuotaService,
    @Inject(PlanGate) private readonly plans: PlanGate,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TurnContextService) private readonly context: TurnContextService,
    @Inject(LibraryService) private readonly library: LibraryService,
  ) {}

  /** SSE turn: intent, vacancy cards, answer tokens, and a file draft when one was asked for. */
  postMessage(input: PostMessageInput, sink: SseSink): Promise<void> {
    return postChatMessage(this.deps(), input, sink);
  }

  /** SSE call turn. The session is not a chat. */
  postCall(input: Omit<CallTurnInput, 'calls'>, sink: SseSink): Promise<void> {
    return postCallTurn(this.deps(), { ...input, calls: this.calls }, sink);
  }

  /** Chat-free search for debugging and the evaluation chapter. */
  direct(input: DirectSearchInput): Promise<RetrievalResponse> {
    return runDirectSearch(this.deps(), input);
  }

  /** Resolves after follow-up work scheduled by the last turns has finished. */
  whenIdle(): Promise<void> {
    return this.idle;
  }

  private deps(): OrchestratorDeps {
    return {
      chats: this.chats,
      llm: this.llm,
      retrieval: this.retrieval,
      quota: this.planQuota(),
      logger: this.logger,
      now: () => this.clock.now().getTime(),
      context: this.context,
      followUp: this.context,
      schedule: (task) => this.schedule(task),
      drafts: this.library,
    };
  }

  /** The search counter with the limit of the account's plan. */
  private planQuota(): QuotaGate {
    const limit = async (userId: string) => (await this.plans.limits(userId)).searchesPerDay;
    return {
      consumeDemo: (sessionId) => this.quota.consumeDemo(sessionId),
      peekDemo: (sessionId) => this.quota.peekDemo(sessionId),
      consumeRegistered: async (userId) => this.quota.consumeRegistered(userId, await limit(userId)),
      peekRegistered: async (userId) => this.quota.peekRegistered(userId, await limit(userId)),
    };
  }

  private schedule(task: Promise<void>): void {
    const safe = task.catch((error: unknown) => {
      this.logger.warn({ err: error }, 'turn follow-up failed');
    });
    this.idle = this.idle.then(() => safe);
  }
}
