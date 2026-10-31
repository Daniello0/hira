import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { AuthorKind } from '@hira/contracts';
import { DataSource } from 'typeorm';
import { typeormRows } from '../database/typeorm-rows';
import type { ActivityRecord } from '../memory/account-activity';
import { callActivity, type CallSessionRecord, type CallStore, type CallTurnRecord } from './call.store';

/** PostgreSQL calls. Rows are not written into `chats`. */
@Injectable()
export class TypeOrmCallStore implements CallStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** @inheritdoc */
  async insertSession(userId: string, startedAt: Date): Promise<CallSessionRecord> {
    const rows = await this.query(
      `INSERT INTO call_sessions (user_id, started_at) VALUES ($1, $2)
       RETURNING id, user_id AS "userId", started_at AS "startedAt", ended_at AS "endedAt"`,
      [userId, startedAt],
    );
    return sessionOf(rows[0]);
  }

  /** @inheritdoc */
  async findSession(id: string): Promise<CallSessionRecord | null> {
    const rows = await this.query(
      `SELECT id, user_id AS "userId", started_at AS "startedAt", ended_at AS "endedAt" FROM call_sessions WHERE id = $1`,
      [id],
    );
    return rows[0] === undefined ? null : sessionOf(rows[0]);
  }

  /** @inheritdoc */
  async endSession(id: string, userId: string, at: Date): Promise<CallSessionRecord | null> {
    const current = await this.ownedSession(id, userId);
    if (current === null || current.endedAt !== null) return current;
    return (await this.markEnded(id, userId, at)) ?? this.ownedSession(id, userId);
  }

  /** @inheritdoc */
  async insertTurn(turn: CallTurnRecord): Promise<CallTurnRecord> {
    const rows = await this.query(
      `INSERT INTO call_turns (id, session_id, role, content, use_memory, results)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, session_id AS "sessionId", role::text AS role, content, use_memory AS "useMemory", results, heard_text AS "heardText", created_at AS "createdAt"`,
      [turn.id || randomUUID(), turn.sessionId, turn.role, turn.content, turn.useMemory, JSON.stringify(turn.results)],
    );
    return turnOf(rows[0]);
  }

  /** @inheritdoc */
  async markHeard(turnId: string, heardText: string): Promise<void> {
    await this.query(`UPDATE call_turns SET heard_text = $2 WHERE id = $1`, [turnId, heardText]);
  }

  /** @inheritdoc */
  async recentTurns(sessionId: string, limit: number): Promise<CallTurnRecord[]> {
    const rows = await this.query(
      `SELECT id, session_id AS "sessionId", role::text AS role, content, use_memory AS "useMemory", results, heard_text AS "heardText", created_at AS "createdAt"
       FROM call_turns WHERE session_id = $1 ORDER BY created_at ASC, id ASC`,
      [sessionId],
    );
    return rows.map(turnOf).slice(-limit);
  }

  /** @inheritdoc */
  async recentActivity(userId: string, limit: number, exceptSessionId: string | null): Promise<ActivityRecord[]> {
    if (limit <= 0) return [];
    const sessions = await this.query(
      `SELECT s.id, s.started_at AS "startedAt" FROM call_sessions s
       WHERE s.user_id = $1 AND ($2::uuid IS NULL OR s.id <> $2::uuid)
         AND EXISTS (SELECT 1 FROM call_turns t WHERE t.session_id = s.id)
       ORDER BY s.started_at DESC, s.id LIMIT $3`,
      [userId, exceptSessionId, limit],
    );
    const turns = await this.query(
      `SELECT id, session_id AS "sessionId", role::text AS role, content, use_memory AS "useMemory", results, heard_text AS "heardText", created_at AS "createdAt"
       FROM call_turns WHERE session_id = ANY($1::uuid[]) ORDER BY created_at DESC, id DESC`,
      [sessions.map((session) => String(session.id))],
    );
    const records = turns.map(turnOf);
    return sessions.map((session) =>
      callActivity(new Date(session.startedAt as string), records.filter((turn) => turn.sessionId === session.id)),
    );
  }

  private async ownedSession(id: string, userId: string): Promise<CallSessionRecord | null> {
    const session = await this.findSession(id);
    if (session === null || session.userId !== userId) return null;
    return session;
  }

  private async markEnded(id: string, userId: string, at: Date): Promise<CallSessionRecord | null> {
    const rows = await this.query(
      `UPDATE call_sessions SET ended_at = $3 WHERE id = $1 AND user_id = $2 AND ended_at IS NULL
       RETURNING id, user_id AS "userId", started_at AS "startedAt", ended_at AS "endedAt"`,
      [id, userId, at],
    );
    return rows[0] === undefined ? null : sessionOf(rows[0]);
  }

  private async query(statement: string, params: unknown[]): Promise<Record<string, unknown>[]> {
    return typeormRows(await this.dataSource.query(statement, params));
  }
}

function sessionOf(row: Record<string, unknown> | undefined): CallSessionRecord {
  if (row === undefined) throw new Error('call row is missing');
  return {
    id: String(row.id),
    userId: String(row.userId),
    startedAt: new Date(row.startedAt as string),
    endedAt: row.endedAt === null || row.endedAt === undefined ? null : new Date(row.endedAt as string),
  };
}

function turnOf(row: Record<string, unknown> | undefined): CallTurnRecord {
  if (row === undefined) throw new Error('call turn is missing');
  return {
    id: String(row.id),
    sessionId: String(row.sessionId),
    role: String(row.role) === 'ASSISTANT' ? AuthorKind.Assistant : AuthorKind.User,
    content: String(row.content),
    useMemory: row.useMemory !== false,
    results: (row.results as CallTurnRecord['results']) ?? null,
    heardText: typeof row.heardText === 'string' ? row.heardText : null,
    createdAt: new Date(row.createdAt as string),
  };
}
