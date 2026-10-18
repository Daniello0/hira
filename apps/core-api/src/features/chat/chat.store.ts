import type {
  MatchExplanation,
  MessageRole,
  RetrievalBranch,
  RetrievalDiagnostics,
  SearchIntent,
  TokenUsage,
  VacancyDto,
} from '@hira/contracts';
import type { PageCursor } from './chat-cursor';

export const CHAT_STORE = Symbol('CHAT_STORE');

/** A registered account or one demo cookie. Exactly one side is set. */
export type ChatOwner = { userId: string } | { demoSessionId: string };

export interface ChatRecord {
  id: string;
  userId: string | null;
  demoSessionId: string | null;
  title: string | null;
  summary: string | null;
  messageCount: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageRecord {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  intent: SearchIntent | null;
  diagnostics: RetrievalDiagnostics | null;
  tokenUsage: TokenUsage | null;
  createdAt: Date;
  useMemory?: boolean;
}

export interface ShownVacancyRecord {
  messageId: string;
  vacancyId: string;
  rank: number;
  score: number;
  explanation: MatchExplanation;
  retrievedBy: RetrievalBranch[];
  /** Filled on read. The memory store keeps the card from the search that showed it. */
  vacancy?: VacancyDto;
}

export interface NewMessage {
  chatId: string;
  role: MessageRole;
  content: string;
  useMemory?: boolean;
}

export interface ChatPatch {
  title?: string;
  isArchived?: boolean;
}

export interface CompletedTurn {
  userMessageId: string;
  chatId: string;
  intent: SearchIntent;
  diagnostics: RetrievalDiagnostics;
  understandUsage: TokenUsage | null;
  content: string;
  generateUsage: TokenUsage | null;
  vacancies: Array<Omit<ShownVacancyRecord, 'messageId'>>;
  rawQuery: string;
  userId: string | null;
}

export interface DirectSearchLog {
  userId: string | null;
  messageId: string | null;
  rawQuery: string;
  intent: SearchIntent;
  diagnostics: RetrievalDiagnostics;
}

/** Dialogue rows. List methods return one extra row so the caller can build `nextCursor`. */
export interface ChatStore {
  insertChat(owner: ChatOwner): Promise<ChatRecord>;
  findChat(id: string): Promise<ChatRecord | null>;
  findDemoChat(demoSessionId: string): Promise<ChatRecord | null>;
  listChats(owner: ChatOwner, cursor: PageCursor | null, limit: number): Promise<ChatRecord[]>;
  updateChat(id: string, owner: ChatOwner, patch: ChatPatch): Promise<ChatRecord | null>;
  deleteChat(id: string, owner: ChatOwner): Promise<boolean>;
  insertMessage(input: NewMessage): Promise<MessageRecord>;
  patchUserMessage(
    id: string,
    intent: SearchIntent,
    tokenUsage: TokenUsage | null,
    diagnostics?: RetrievalDiagnostics | null,
  ): Promise<void>;
  recentMessages(chatId: string, limit: number): Promise<MessageRecord[]>;
  findMessage(chatId: string, id: string): Promise<MessageRecord | null>;
  listMessages(chatId: string, cursor: PageCursor | null, limit: number): Promise<MessageRecord[]>;
  vacanciesFor(messageIds: string[]): Promise<ShownVacancyRecord[]>;
  completeTurn(input: CompletedTurn): Promise<MessageRecord>;
  setTitleIfEmpty(chatId: string, title: string): Promise<void>;
  setSummary(chatId: string, summary: string): Promise<void>;
  chronologicalMessages(chatId: string): Promise<MessageRecord[]>;
  insertSearchLog(input: DirectSearchLog): Promise<void>;
}
