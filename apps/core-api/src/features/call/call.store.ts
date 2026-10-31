import { AuthorKind } from '@hira/contracts';
import type { VacancyResult } from '@hira/contracts';
import { ACTIVITY_QUERIES, ACTIVITY_VACANCIES, promptVacancy, type ActivityRecord } from '../memory/account-activity';

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
  /** What the user heard of a reply they cut off. Absent: it was spoken to the end. */
  heardText?: string | null;
}

export interface CallStore {
  insertSession(userId: string, startedAt: Date): Promise<CallSessionRecord>;
  findSession(id: string): Promise<CallSessionRecord | null>;
  endSession(id: string, userId: string, at: Date): Promise<CallSessionRecord | null>;
  insertTurn(turn: CallTurnRecord): Promise<CallTurnRecord>;
  /** Records how far a reply got before the user cut it off. */
  markHeard(turnId: string, heardText: string): Promise<void>;
  recentTurns(sessionId: string, limit: number): Promise<CallTurnRecord[]>;
  /** Earlier calls of an account with turns, newest first, leaving out the open one. */
  recentActivity(userId: string, limit: number, exceptSessionId: string | null): Promise<ActivityRecord[]>;
}

/** One earlier call as Hira may speak about it. `turns` are newest first. */
export function callActivity(at: Date, turns: readonly CallTurnRecord[]): ActivityRecord {
  const asked = turns.filter((turn) => turn.role === AuthorKind.User).map((turn) => turn.content);
  const shown = turns.flatMap((turn) => turn.results ?? []).map((result) => promptVacancy(result.vacancy));
  return { kind: 'call', title: null, summary: null, at, queries: asked.slice(0, ACTIVITY_QUERIES), vacancies: shown.slice(0, ACTIVITY_VACANCIES) };
}
