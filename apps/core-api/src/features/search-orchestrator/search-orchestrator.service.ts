import { Inject, Injectable } from '@nestjs/common';
import type { Logger } from 'pino';
import { LOGGER } from '../../common/constants/app.constants';
import { CLOCK, type Clock } from '../../common/utils/clock';
import { CHAT_STORE, type ChatStore } from '../chat/chat.store';
import { SearchQuotaService } from '../rate-limit/search-quota.service';
import {
  postChatMessage,
  runDirectSearch,
  type DirectSearchInput,
  type OrchestratorDeps,
  type PostMessageInput,
  type SseSink,
} from './orchestrate-search';
import { LLM_GATEWAY, RETRIEVAL_GATEWAY } from './search.constants';
import type { LlmGateway, RetrievalGateway } from './upstream-gateway';
import type { RetrievalResponse } from '@hira/contracts';

/** Nest wrapper around the search turn. Upstream clients and the quota counter are injected. */
@Injectable()
export class SearchOrchestratorService {
  constructor(
    @Inject(CHAT_STORE) private readonly chats: ChatStore,
    @Inject(LLM_GATEWAY) private readonly llm: LlmGateway,
    @Inject(RETRIEVAL_GATEWAY) private readonly retrieval: RetrievalGateway,
    @Inject(SearchQuotaService) private readonly quota: SearchQuotaService,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** SSE turn: intent, vacancy cards, then answer tokens. */
  postMessage(input: PostMessageInput, sink: SseSink): Promise<void> {
    return postChatMessage(this.deps(), input, sink);
  }

  /** Chat-free search for debugging and the evaluation chapter. */
  direct(input: DirectSearchInput): Promise<RetrievalResponse> {
    return runDirectSearch(this.deps(), input);
  }

  private deps(): OrchestratorDeps {
    return {
      chats: this.chats,
      llm: this.llm,
      retrieval: this.retrieval,
      quota: this.quota,
      logger: this.logger,
      now: () => this.clock.now().getTime(),
    };
  }
}
