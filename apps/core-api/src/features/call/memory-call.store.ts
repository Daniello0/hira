import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ActivityRecord } from '../memory/account-activity';
import { callActivity, type CallSessionRecord, type CallStore, type CallTurnRecord } from './call.store';

/** Process-local calls. They are never inserted into chats. */
@Injectable()
export class MemoryCallStore implements CallStore {
  readonly sessions: CallSessionRecord[] = [];
  readonly turns: CallTurnRecord[] = [];

  /** @inheritdoc */
  async recentActivity(userId: string, limit: number, exceptSessionId: string | null): Promise<ActivityRecord[]> {
    return this.sessions
      .filter((session) => session.userId === userId && session.id !== exceptSessionId)
      .map((session) => ({ session, turns: this.turns.filter((turn) => turn.sessionId === session.id).reverse() }))
      .filter(({ turns }) => turns.length > 0)
      .reverse()
      .slice(0, limit)
      .map(({ session, turns }) => callActivity(session.startedAt, turns));
  }

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
  async markHeard(turnId: string, heardText: string): Promise<void> {
    const index = this.turns.findIndex((turn) => turn.id === turnId);
    const turn = this.turns[index];
    if (turn !== undefined) this.turns[index] = { ...turn, heardText };
  }

  /** @inheritdoc */
  async recentTurns(sessionId: string, limit: number): Promise<CallTurnRecord[]> {
    return this.turns.filter((turn) => turn.sessionId === sessionId).slice(-limit);
  }
}
