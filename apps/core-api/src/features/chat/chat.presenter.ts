import { MessageRole, type ChatMessageView, type ChatSummary, type VacancyResult } from '@hira/contracts';
import type { ChatRecord, MessageRecord, ShownVacancyRecord } from './chat.store';

/** JSON chat. Timestamps are ISO-8601. */
export function toChatSummary(chat: ChatRecord): ChatSummary {
  return {
    id: chat.id,
    title: chat.title,
    isArchived: chat.isArchived,
    messageCount: chat.messageCount,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  };
}

/** JSON message. Assistant rows carry the frozen ranking in `results`. */
export function toMessageView(message: MessageRecord, vacancies: ShownVacancyRecord[]): ChatMessageView {
  const view: ChatMessageView = {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
  if (message.role !== MessageRole.Assistant) return view;
  return { ...view, results: resultsOf(message.id, vacancies) };
}

/** Drops the lookahead row. `nextCursor` is the id of the oldest kept row. */
export function cutIdPage<T extends { id: string }>(
  newestFirst: T[],
  limit: number,
  chronological: boolean,
): { items: T[]; nextCursor: string | null } {
  const hasMore = newestFirst.length > limit;
  const kept = newestFirst.slice(0, limit);
  const oldest = kept[kept.length - 1];
  return {
    items: chronological ? [...kept].reverse() : kept,
    nextCursor: hasMore && oldest !== undefined ? oldest.id : null,
  };
}

function resultsOf(messageId: string, vacancies: ShownVacancyRecord[]): VacancyResult[] {
  return vacancies.filter((row) => row.messageId === messageId && row.vacancy !== undefined).map(toResult);
}

function toResult(row: ShownVacancyRecord): VacancyResult {
  return {
    vacancy: row.vacancy as VacancyResult['vacancy'],
    score: row.score,
    explanation: row.explanation,
    retrievedBy: row.retrievedBy,
  };
}
