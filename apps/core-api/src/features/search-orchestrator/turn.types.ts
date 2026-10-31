import type { MessageRole, PromptVacancy, RetrievalRequest, RetrievalResponse, SearchIntent, TokenUsage } from '@hira/contracts';
import type { ChatRecord, ChatStore } from '../chat/chat.store';
import type { Caller } from '../chat/resolve-actor';
import type { DraftTarget } from '../library/draft-target';
import type { TurnContext } from '../memory/assemble-context';
import type { QuotaConsumption } from '../rate-limit/search-quota';
import type { LlmGateway, RetrievalGateway } from './upstream-gateway';

export interface SseSink {
  open(): void;
  write(event: string, data: unknown): void;
}

export interface QuotaGate {
  consumeDemo(sessionId: string): Promise<QuotaConsumption>;
  consumeRegistered(userId: string): Promise<QuotaConsumption>;
  /** Reads the counter without spending it. `allowed` is false when nothing is left. */
  peekDemo?(sessionId: string): Promise<QuotaConsumption>;
  /** Reads the counter without spending it. `allowed` is false when nothing is left. */
  peekRegistered?(userId: string): Promise<QuotaConsumption>;
}

export interface ContextLoad {
  caller: Caller;
  query: string;
  useMemory: boolean;
  summary: string | null;
  /** The open chat or call, left out of the earlier ones. */
  chatId?: string | null;
  callSessionId?: string | null;
  /** Vacancies shown earlier in this conversation. */
  shownHere?: PromptVacancy[];
}

export interface FollowUpJob {
  extract: boolean;
  userId: string | null;
  chatId: string | null;
  sourceMessageId: string | null;
  sourceCallTurnId: string | null;
  sourceCallSessionId: string | null;
  /** Stored messages before this turn. The summary runs when the count crosses its interval. */
  previousCount: number;
  messageCount: number;
  previousSummary: string | null;
  exchange: { role: MessageRole; content: string }[];
}

/** Library lookup for `DRAFT_DOCUMENT` turns. */
export interface DraftLookup {
  draftTarget(userId: string, text: string): Promise<DraftTarget | null>;
}

export interface OrchestratorDeps {
  chats: ChatStore;
  llm: LlmGateway;
  retrieval: RetrievalGateway;
  quota: QuotaGate;
  logger: { warn(obj: object, message: string): void };
  now(): number;
  context?: { load(input: ContextLoad): Promise<TurnContext> };
  followUp?: { after(job: FollowUpJob): Promise<void> };
  schedule?: (task: Promise<void>) => void;
  drafts?: DraftLookup;
}

/** Options every turn shares, chat or call. */
export interface TurnOptions {
  useMemory?: boolean;
  /** `false` hides foreign remote vacancies for this turn (Q30). */
  includeForeignRemote?: boolean;
  /** Aborted when the client goes away. Upstream calls stop and follow-ups are skipped. */
  signal?: AbortSignal;
}

export interface PostMessageInput extends TurnOptions {
  caller: Caller;
  chat: ChatRecord;
  content: string;
  requestId: string;
}

export interface DirectSearchInput {
  caller: Caller;
  request: RetrievalRequest;
  requestId: string;
}

export interface Understood {
  intent: SearchIntent;
  usage: TokenUsage | null;
  /** llm-service failed and the intent came from the heuristic. */
  degraded: boolean;
}

export interface Answer {
  text: string;
  usage: TokenUsage | null;
  /** The model stream threw. A partial text is still stored; memory is not extracted. */
  failed: boolean;
}

/** Everything a finished turn produced, before the caller stores it. */
export interface TurnOutcome {
  understood: Understood;
  retrieval: RetrievalResponse;
  answer: Answer;
  context: TurnContext;
  /** Memory extraction is worth a model call for this turn. */
  extract: boolean;
}
