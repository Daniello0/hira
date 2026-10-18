import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { CallSessionRecord, CallStore, CallTurnRecord } from './call.store';

/** Process-local calls. They are never inserted into chats. */
@Injectable()
export class MemoryCallStore implements CallStore {
  readonly sessions: CallSessionRecord[] = [];
  readonly turns: CallTurnRecord[] = [];

  /** @inheritdoc */
  async insertSession(userId: string, startedAt: Date): Promise<CallSessionRecord> {
    const session = { id: randomUUID(), userId, startedAt, endedAt: null };
    this.sessions.push(session);
    return session;
  }

  /** @inheritdoc */
  async findSession(id: string): Promise<CallSessionRecord | null> {
    return this.sessions.find((session) => session.id === id) ?? null;
  }

  /** @inheritdoc */
  async endSession(id: string, userId: string, at: Date): Promise<CallSessionRecord | null> {
    const session = this.sessions.find((item) => item.id === id && item.userId === userId);
    if (session === undefined) return null;
    if (session.endedAt === null) session.endedAt = at;
    return session;
  }

  /** @inheritdoc */
  async insertTurn(turn: CallTurnRecord): Promise<CallTurnRecord> {
    this.turns.push(turn);
    return turn;
  }

  /** @inheritdoc */
  async recentTurns(sessionId: string, limit: number): Promise<CallTurnRecord[]> {
    return this.turns.filter((turn) => turn.sessionId === sessionId).slice(-limit);
  }
}
