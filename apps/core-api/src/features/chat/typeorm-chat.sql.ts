import { MessageRole, type RetrievalDiagnostics, type SearchIntent, type TokenUsage } from '@hira/contracts';
import type { EntityManager } from 'typeorm';
import type { PageCursor } from './chat-cursor';
import type {
  ChatOwner,
  ChatPatch,
  ChatRecord,
  CompletedTurn,
  DirectSearchLog,
  MessageRecord,
  NewMessage,
  ShownVacancyRecord,
} from './chat.store';

export interface Sql {
  query(statement: string, params?: unknown[]): Promise<unknown>;
}

const CHAT_COLUMNS = `id, user_id AS "userId", demo_session_id AS "demoSessionId", title, summary,
  message_count AS "messageCount", is_archived AS "isArchived", created_at AS "createdAt", updated_at AS "updatedAt"`;

const MESSAGE_COLUMNS = `id, chat_id AS "chatId", role, content, use_memory AS "useMemory", intent, diagnostics,
  token_usage AS "tokenUsage", created_at AS "createdAt"`;

/** Inserts an empty chat and returns the row. */
export async function insertChat(sql: Sql, owner: ChatOwner): Promise<ChatRecord> {
  const rows = await rowsOf(sql, `INSERT INTO chats (user_id, demo_session_id) VALUES ($1, $2) RETURNING ${CHAT_COLUMNS}`, [
    'userId' in owner ? owner.userId : null,
    'demoSessionId' in owner ? owner.demoSessionId : null,
  ]);
  return toChat(rows[0]);
}

/** The one chat stored for a demo cookie. */
export async function findDemoChat(sql: Sql, demoSessionId: string): Promise<ChatRecord | null> {
  const rows = await rowsOf(sql, `SELECT ${CHAT_COLUMNS} FROM chats WHERE demo_session_id = $1`, [demoSessionId]);
  return rows[0] === undefined ? null : toChat(rows[0]);
}

/** Moves a guest chat with messages, and its search logs, to the account in one statement. */
export async function claimDemoChat(sql: Sql, demoSessionId: string, userId: string): Promise<ChatRecord | null> {
  const rows = await rowsOf(
    sql,
    `WITH claimed AS (
       UPDATE chats SET user_id = $2, demo_session_id = NULL
       WHERE demo_session_id = $1 AND message_count > 0
       RETURNING ${CHAT_COLUMNS}
     ), logs AS (
       UPDATE search_logs SET user_id = $2
       WHERE message_id IN (SELECT m.id FROM messages m JOIN claimed c ON m.chat_id = c.id)
     )
     SELECT * FROM claimed`,
    [demoSessionId, userId],
  );
  return rows[0] === undefined ? null : toChat(rows[0]);
}

/** Loads one chat, or null. */
export async function findChat(sql: Sql, id: string): Promise<ChatRecord | null> {
  const rows = await rowsOf(sql, `SELECT ${CHAT_COLUMNS} FROM chats WHERE id = $1`, [id]);
  return rows[0] === undefined ? null : toChat(rows[0]);
}

/** How many chats this user owns. */
export async function countChats(sql: Sql, userId: string): Promise<number> {
  const rows = await rowsOf(sql, 'SELECT count(*)::int AS count FROM chats WHERE user_id = $1', [userId]);
  return Number(readCount(rows[0]));
}

/** Newest activity first, one row past `limit`. */
export async function listChats(
  sql: Sql,
  owner: ChatOwner,
  cursor: PageCursor | null,
  limit: number,
  titleQuery?: string,
): Promise<ChatRecord[]> {
  const rows = await rowsOf(sql, chatPageSql(), [
    'userId' in owner ? owner.userId : null,
    'demoSessionId' in owner ? owner.demoSessionId : null,
    cursor?.at ?? null,
    cursor?.id ?? null,
    limit + 1,
    titleQuery === undefined ? null : `%${escapeLike(titleQuery)}%`,
  ]);
  return rows.map(toChat);
}

/** Applies a rename or archive. Returns null when the chat is not theirs. */
export async function updateChat(
  sql: Sql,
  id: string,
  owner: ChatOwner,
  patch: ChatPatch,
): Promise<ChatRecord | null> {
  const assignment = assignments(patch);
  if (assignment.sql.length === 0) return findChat(sql, id);
  const rows = await rowsOf(sql, updateSql(assignment.sql), [id, ...ownerParams(owner), ...assignment.values]);
  return rows[0] === undefined ? null : toChat(rows[0]);
}

/** Deletes a chat the user owns. Messages go with it. */
export async function deleteChat(sql: Sql, id: string, owner: ChatOwner): Promise<boolean> {
  const rows = await rowsOf(sql, `DELETE FROM chats WHERE id = $1 AND ${ownerSql('$2', '$3')} RETURNING id`, [
    id,
    ...ownerParams(owner),
  ]);
  return rows.length > 0;
}

/** Stores one turn and increments the chat counter. */
export async function insertMessage(sql: Sql, input: NewMessage): Promise<MessageRecord> {
  const rows = await rowsOf(sql, insertMessageSql(), [
    input.chatId,
    input.role,
    input.content,
    input.useMemory !== false,
  ]);
  await bumpChat(sql, input.chatId);
  return toMessage(rows[0]);
}

/** Keeps the intent when retrieval fails before the assistant turn is stored. */
export async function patchUserMessage(
  sql: Sql,
  id: string,
  intent: SearchIntent,
  tokenUsage: TokenUsage | null,
  diagnostics?: RetrievalDiagnostics | null,
): Promise<void> {
  if (diagnostics === undefined) {
    await sql.query('UPDATE messages SET intent = $2::jsonb, token_usage = $3::jsonb WHERE id = $1', [
      id,
      json(intent),
      json(tokenUsage),
    ]);
    return;
  }
  await sql.query(
    'UPDATE messages SET intent = $2::jsonb, token_usage = $3::jsonb, diagnostics = $4::jsonb WHERE id = $1',
    [id, json(intent), json(tokenUsage), json(diagnostics)],
  );
}

/** One message in a chat, or null. */
export async function findMessage(sql: Sql, chatId: string, id: string): Promise<MessageRecord | null> {
  const rows = await rowsOf(sql, `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE chat_id = $1 AND id = $2`, [
    chatId,
    id,
  ]);
  return rows[0] === undefined ? null : toMessage(rows[0]);
}

/** Oldest-first window of the latest messages. */
export async function recentMessages(sql: Sql, chatId: string, limit: number): Promise<MessageRecord[]> {
  const rows = await rowsOf(sql, recentSql(), [chatId, limit]);
  return rows.map(toMessage).reverse();
}

/** Every message in a chat, oldest first. */
export async function chronologicalMessages(sql: Sql, chatId: string): Promise<MessageRecord[]> {
  const rows = await rowsOf(
    sql,
    `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE chat_id = $1 ORDER BY created_at ASC, id ASC`,
    [chatId],
  );
  return rows.map(toMessage);
}

/** Stores the rolling summary. A failed model call must not call this. */
export async function setSummary(sql: Sql, chatId: string, summary: string): Promise<void> {
  await sql.query('UPDATE chats SET summary = $2, summary_updated_at = now() WHERE id = $1', [chatId, summary]);
}

/** Newest first, one row past `limit`. */
export async function listMessages(
  sql: Sql,
  chatId: string,
  cursor: PageCursor | null,
  limit: number,
): Promise<MessageRecord[]> {
  const rows = await rowsOf(sql, messagePageSql(), [
    chatId,
    cursor?.at ?? null,
    cursor?.id ?? null,
    limit + 1,
  ]);
  return rows.map(toMessage);
}

/** Snapshots for a page of messages, rank order. */
export async function vacanciesFor(sql: Sql, messageIds: string[]): Promise<ShownVacancyRecord[]> {
  if (messageIds.length === 0) return [];
  const rows = await rowsOf(sql, vacancySql(), [messageIds]);
  return rows.map(toVacancy);
}

/** Writes the assistant turn and the vacancy snapshots in one transaction. */
export async function completeTurn(manager: EntityManager, input: CompletedTurn): Promise<MessageRecord> {
  const sql = asSql(manager);
  await patchTurn(sql, input);
  const assistant = await insertAssistant(sql, input);
  await insertVacancies(sql, assistant.id, input.vacancies);
  return assistant;
}

async function insertAssistant(sql: Sql, input: CompletedTurn): Promise<MessageRecord> {
  const assistant = await insertMessage(sql, {
    chatId: input.chatId,
    role: MessageRole.Assistant,
    content: input.content,
  });
  await sql.query('UPDATE messages SET token_usage = $2::jsonb WHERE id = $1', [
    assistant.id,
    json(input.generateUsage),
  ]);
  return { ...assistant, tokenUsage: input.generateUsage };
}

/** Sets a title only while the user has not named the chat. */
export async function setTitleIfEmpty(sql: Sql, chatId: string, title: string): Promise<void> {
  await sql.query('UPDATE chats SET title = $2 WHERE id = $1 AND title IS NULL', [chatId, title]);
}

/** Telemetry for a search that is not tied to an assistant turn. */
export async function insertSearchLog(sql: Sql, input: DirectSearchLog): Promise<void> {
  await sql.query(searchLogSql(), searchLogParams(input));
}

/** Adapts a TypeORM source to `Sql`. The driver types parameters as `any`. */
export function asSql(source: { query(statement: string, parameters?: never[]): Promise<unknown> }): Sql {
  return {
    query: (statement, params) => source.query(statement, params as never[]),
  };
}

function chatPageSql(): string {
  return `SELECT ${CHAT_COLUMNS} FROM chats
    WHERE ${ownerSql('$1', '$2')}
      AND ($3::timestamptz IS NULL OR updated_at < $3 OR (updated_at = $3 AND id < $4::uuid))
      AND ($6::text IS NULL OR title ILIKE $6)
    ORDER BY updated_at DESC, id DESC
    LIMIT $5`;
}

/** A typed `%` or `_` is text, not a pattern. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (mark) => `\\${mark}`);
}

function ownerSql(userSlot: string, demoSlot: string): string {
  return `((${userSlot}::uuid IS NOT NULL AND user_id = ${userSlot}::uuid)
    OR (${demoSlot}::uuid IS NOT NULL AND demo_session_id = ${demoSlot}::uuid))`;
}

function ownerParams(owner: ChatOwner): [string | null, string | null] {
  return ['userId' in owner ? owner.userId : null, 'demoSessionId' in owner ? owner.demoSessionId : null];
}

function messagePageSql(): string {
  return `SELECT ${MESSAGE_COLUMNS} FROM messages
    WHERE chat_id = $1
      AND ($2::timestamptz IS NULL OR created_at < $2 OR (created_at = $2 AND id < $3::uuid))
    ORDER BY created_at DESC, id DESC
    LIMIT $4`;
}

function recentSql(): string {
  return `SELECT ${MESSAGE_COLUMNS} FROM messages
    WHERE chat_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT $2`;
}

function insertMessageSql(): string {
  return `INSERT INTO messages (chat_id, role, content, use_memory) VALUES ($1, $2, $3, $4) RETURNING ${MESSAGE_COLUMNS}`;
}

function vacancySql(): string {
  return `SELECT message_id AS "messageId", vacancy_id AS "vacancyId", rank, score,
            explanation, retrieved_by AS "retrievedBy"
     FROM message_vacancies
     WHERE message_id = ANY($1::uuid[])
     ORDER BY rank ASC`;
}

function updateSql(assignment: string): string {
  return `UPDATE chats SET ${assignment} WHERE id = $1 AND ${ownerSql('$2', '$3')} RETURNING ${CHAT_COLUMNS}`;
}

function searchLogSql(): string {
  return `INSERT INTO search_logs (
    user_id, message_id, raw_query, intent, branch_timings, candidate_counts,
    total_latency_ms, rerank_applied, relaxation_steps
  ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9::jsonb)`;
}

async function patchTurn(sql: Sql, input: CompletedTurn): Promise<void> {
  await sql.query(
    `UPDATE messages SET intent = $2::jsonb, diagnostics = $3::jsonb, token_usage = $4::jsonb WHERE id = $1`,
    [input.userMessageId, json(input.intent), json(input.diagnostics), json(input.understandUsage)],
  );
}

async function insertVacancies(
  sql: Sql,
  messageId: string,
  vacancies: CompletedTurn['vacancies'],
): Promise<void> {
  for (const vacancy of vacancies) {
    await sql.query(
      `INSERT INTO message_vacancies (message_id, vacancy_id, rank, score, explanation, retrieved_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        messageId,
        vacancy.vacancyId,
        vacancy.rank,
        vacancy.score,
        json(vacancy.explanation),
        vacancy.retrievedBy,
      ],
    );
  }
}

async function bumpChat(sql: Sql, chatId: string): Promise<void> {
  await sql.query('UPDATE chats SET message_count = message_count + 1 WHERE id = $1', [chatId]);
}

function assignments(patch: ChatPatch): { sql: string; values: unknown[] } {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.title !== undefined) pushSet(sets, values, 'title', patch.title);
  if (patch.isArchived !== undefined) pushSet(sets, values, 'is_archived', patch.isArchived);
  return { sql: sets.join(', '), values };
}

function pushSet(sets: string[], values: unknown[], column: string, value: unknown): void {
  values.push(value);
  sets.push(`${column} = $${values.length + 3}`);
}

function searchLogParams(input: DirectSearchLog): unknown[] {
  return [
    input.userId,
    input.messageId,
    input.rawQuery,
    json(input.intent),
    json(input.diagnostics.branchTimings),
    json(input.diagnostics.candidateCounts),
    input.diagnostics.totalLatencyMs,
    input.diagnostics.rerankApplied,
    json(input.diagnostics.relaxationSteps),
  ];
}

async function rowsOf(sql: Sql, statement: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const rows = await sql.query(statement, params);
  return recordsOf(rows);
}

/** TypeORM returns `[rows, rowCount]` for UPDATE and DELETE. SELECT and INSERT return rows. */
function recordsOf(rows: unknown): Record<string, unknown>[] {
  if (isUpdateTuple(rows)) return rows[0];
  if (Array.isArray(rows)) return rows as Record<string, unknown>[];
  return [];
}

function isUpdateTuple(value: unknown): value is [Record<string, unknown>[], number | null] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Array.isArray(value[0]) &&
    (typeof value[1] === 'number' || value[1] === null)
  );
}

function toChat(row: Record<string, unknown> | undefined): ChatRecord {
  if (row === undefined) throw new Error('chat row is missing');
  return {
    id: text(row.id),
    userId: nullableText(row.userId),
    demoSessionId: nullableText(row.demoSessionId),
    title: nullableText(row.title),
    summary: nullableText(row.summary),
    messageCount: Number(row.messageCount),
    isArchived: row.isArchived === true,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  };
}

function toMessage(row: Record<string, unknown> | undefined): MessageRecord {
  if (row === undefined) throw new Error('message row is missing');
  return {
    id: text(row.id),
    chatId: text(row.chatId),
    role: text(row.role) as MessageRecord['role'],
    content: text(row.content),
    intent: (row.intent as SearchIntent | null) ?? null,
    diagnostics: (row.diagnostics as RetrievalDiagnostics | null) ?? null,
    tokenUsage: (row.tokenUsage as TokenUsage | null) ?? null,
    createdAt: asDate(row.createdAt),
    useMemory: row.useMemory !== false,
  };
}

function toVacancy(row: Record<string, unknown>): ShownVacancyRecord {
  return {
    messageId: text(row.messageId),
    vacancyId: text(row.vacancyId),
    rank: Number(row.rank),
    score: Number(row.score),
    explanation: row.explanation as ShownVacancyRecord['explanation'],
    retrievedBy: row.retrievedBy as ShownVacancyRecord['retrievedBy'],
  };
}

function readCount(row: Record<string, unknown> | undefined): unknown {
  return row?.count ?? 0;
}

function json(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  return new Date(typeof value === 'string' ? value : 0);
}
