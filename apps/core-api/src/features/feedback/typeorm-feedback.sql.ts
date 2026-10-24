import type { FeedbackDto, FeedbackRating } from '@hira/contracts';
import type { Sql } from '../chat/typeorm-chat.sql';
import { typeormRows } from '../database/typeorm-rows';

export interface NewFeedback {
  userId: string;
  messageId: string;
  vacancyId: string;
  rating: FeedbackRating;
  comment: string | null;
}

const FEEDBACK_COLUMNS = `id::text AS id, message_id::text AS "messageId", vacancy_id::text AS "vacancyId",
  rating::text AS rating, comment, created_at AS "createdAt"`;

/** True when the message sits in one of the account's chats. */
export async function ownsMessage(sql: Sql, userId: string, messageId: string): Promise<boolean> {
  const rows = typeormRows(await sql.query(
    'SELECT 1 FROM messages m JOIN chats c ON c.id = m.chat_id WHERE m.id = $1 AND c.user_id = $2',
    [messageId, userId],
  ));
  return rows.length > 0;
}

/** Inserts a vote, or replaces the rating and comment of the vote already on this pair. */
export async function upsertFeedback(sql: Sql, input: NewFeedback): Promise<FeedbackDto> {
  const rows = typeormRows(await sql.query(
    `INSERT INTO feedback (user_id, message_id, vacancy_id, rating, comment) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, message_id, vacancy_id)
     DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
     RETURNING ${FEEDBACK_COLUMNS}`,
    [input.userId, input.messageId, input.vacancyId, input.rating, input.comment],
  ));
  return toFeedback(rows[0]);
}

function toFeedback(row: Record<string, unknown> | undefined): FeedbackDto {
  if (row === undefined) throw new Error('feedback row is missing');
  return {
    id: String(row.id),
    messageId: String(row.messageId),
    vacancyId: String(row.vacancyId),
    rating: String(row.rating) as FeedbackRating,
    comment: typeof row.comment === 'string' ? row.comment : null,
    createdAt: new Date(row.createdAt instanceof Date ? row.createdAt : String(row.createdAt)).toISOString(),
  };
}
