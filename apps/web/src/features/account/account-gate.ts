import { SessionStatus } from '../auth/session-status';

/** Where an anonymous visitor is sent. An account stays on the page. */
export function accountDestination(status: SessionStatus): '/login' | null {
  if (status === SessionStatus.Anonymous) return '/login';
  return null;
}

/** The session is still refreshing, so the page must not call account APIs yet. */
export function accountPending(status: SessionStatus): boolean {
  return status === SessionStatus.Unknown;
}
