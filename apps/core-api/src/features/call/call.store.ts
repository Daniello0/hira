import type { AuthorKind } from '@hira/contracts';
import type { VacancyResult } from '@hira/contracts';

export const CALL_STORE = Symbol('CALL_STORE');

export interface CallSessionRecord {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
}

export interface CallTurnRecord {
  id: string;
  sessionId: string;
  role: AuthorKind;
  content: string;
  useMemory: boolean;
  results: VacancyResult[] | null;
  createdAt: Date;
}

export interface CallStore {
  insertSession(userId: string, startedAt: Date): Promise<CallSessionRecord>;
  findSession(id: string): Promise<CallSessionRecord | null>;
  endSession(id: string, userId: string, at: Date): Promise<CallSessionRecord | null>;
  insertTurn(turn: CallTurnRecord): Promise<CallTurnRecord>;
  recentTurns(sessionId: string, limit: number): Promise<CallTurnRecord[]>;
}
