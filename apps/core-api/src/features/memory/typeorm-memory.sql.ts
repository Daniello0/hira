import { MemoryKind } from '@hira/contracts';
import type { Sql } from '../chat/typeorm-chat.sql';
import { parseVector, formatVector } from '../embed/vector-text';
import type { FactPatch } from './memory.store';
import type { MemoryFact } from './memory.types';

const MEMORY_FROM = `FROM user_memories um
  LEFT JOIN messages sm ON sm.id = um.source_message_id
  LEFT JOIN call_turns ct ON ct.id = um.source_call_turn_id`;

const COLUMNS = `um.id, um.user_id AS "userId", um.kind::text AS kind, um.content, um.embedding::text AS embedding,
  um.confidence, um.source_message_id AS "sourceMessageId", um.source_call_turn_id AS "sourceCallTurnId",
  sm.chat_id::text AS "sourceChatId", ct.session_id::text AS "sourceCallSessionId",
  um.is_pinned AS "isPinned", um.expires_at AS "expiresAt", um.revoked_at AS "revokedAt", um.created_at AS "createdAt"`;

/** Lists every fact for an account, including revoked rows. */
export async function listFacts(sql: Sql, userId: string): Promise<MemoryFact[]> {
  const rows = await rowsOf(sql, `SELECT ${COLUMNS} ${MEMORY_FROM} WHERE um.user_id = $1`, [userId]);
  return rows.map(toFact);
}

/** Inserts one fact. */
export async function insertFact(sql: Sql, fact: MemoryFact): Promise<MemoryFact> {
  await rowsOf(sql, insertSql(), [
    fact.id,
    fact.userId,
    fact.kind,
    fact.content,
    formatVector(fact.embedding),
    fact.confidence,
    fact.sourceMessageId,
    fact.sourceCallTurnId,
    fact.isPinned,
    fact.expiresAt,
    fact.revokedAt,
  ]);
  const saved = await findFact(sql, fact.id, fact.userId);
  if (saved === null) throw new Error('memory insert did not persist');
  return saved;
}

/** Patches one owned fact. */
export async function updateFact(sql: Sql, id: string, userId: string, patch: FactPatch): Promise<MemoryFact | null> {
  const sets: string[] = [];
  const values: unknown[] = [id, userId];
  push(sets, values, patch, 'content', 'content');
  push(sets, values, patch, 'kind', 'kind');
  push(sets, values, patch, 'confidence', 'confidence');
  push(sets, values, patch, 'isPinned', 'is_pinned');
  push(sets, values, patch, 'expiresAt', 'expires_at');
  push(sets, values, patch, 'revokedAt', 'revoked_at');
  if (patch.embedding !== undefined) {
    values.push(formatVector(patch.embedding));
    sets.push(`embedding = $${values.length}::vector`);
  }
  if (sets.length === 0) return findFact(sql, id, userId);
  await rowsOf(
    sql,
    `UPDATE user_memories SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2`,
    values,
  );
  return findFact(sql, id, userId);
}

/** Marks one live fact revoked. */
export async function revokeFact(sql: Sql, id: string, userId: string, at: Date): Promise<boolean> {
  const rows = await rowsOf(
    sql,
    `UPDATE user_memories SET revoked_at = $3 WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`,
    [id, userId, at],
  );
  return rows.length > 0;
}

/** Marks every live fact for the account revoked. */
export async function revokeAllFacts(sql: Sql, userId: string, at: Date): Promise<number> {
  const rows = await rowsOf(
    sql,
    `UPDATE user_memories SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`,
    [userId, at],
  );
  return rows.length;
}

async function findFact(sql: Sql, id: string, userId: string): Promise<MemoryFact | null> {
  const rows = await rowsOf(sql, `SELECT ${COLUMNS} ${MEMORY_FROM} WHERE um.id = $1 AND um.user_id = $2`, [id, userId]);
  return rows[0] === undefined ? null : toFact(rows[0]);
}

function insertSql(): string {
  return `INSERT INTO user_memories (
    id, user_id, kind, content, embedding, confidence, source_message_id, source_call_turn_id,
    is_pinned, expires_at, revoked_at
  ) VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8, $9, $10, $11)`;
}

function push(sets: string[], values: unknown[], patch: FactPatch, key: keyof FactPatch, column: string): void {
  if (patch[key] === undefined) return;
  values.push(patch[key]);
  sets.push(`${column} = $${values.length}`);
}

function toFact(row: Record<string, unknown> | undefined): MemoryFact {
  if (row === undefined) throw new Error('memory row is missing');
  return {
    id: text(row.id),
    userId: text(row.userId),
    kind: text(row.kind) as MemoryKind,
    content: text(row.content),
    embedding: parseVector(row.embedding),
    confidence: Number(row.confidence),
    sourceMessageId: nullable(row.sourceMessageId),
    sourceCallTurnId: nullable(row.sourceCallTurnId),
    sourceChatId: nullable(row.sourceChatId),
    sourceCallSessionId: nullable(row.sourceCallSessionId),
    isPinned: row.isPinned === true,
    expiresAt: row.expiresAt === null || row.expiresAt === undefined ? null : new Date(textDate(row.expiresAt)),
    revokedAt: row.revokedAt === null || row.revokedAt === undefined ? null : new Date(textDate(row.revokedAt)),
    createdAt: new Date(textDate(row.createdAt)),
  };
}

async function rowsOf(sql: Sql, statement: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const rows = await sql.query(statement, params);
  if (Array.isArray(rows) && Array.isArray(rows[0]) && rows.length === 2) return rows[0] as Record<string, unknown>[];
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullable(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function textDate(value: unknown): string | number {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return 0;
}
