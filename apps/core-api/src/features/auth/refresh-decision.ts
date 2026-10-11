export interface RefreshState {
  revokedAt: Date | null;
  expiresAt: Date;
}

export type RefreshDecision = 'invalid' | 'reused' | 'rotate';

/**
 * Decides what a presented refresh token means.
 * An expired token is invalid. A revoked token is reuse and revokes the user's other sessions.
 * The schema has no separate family id: every active refresh token of the user is the family.
 */
export function decideRefresh(row: RefreshState | null, now: Date): RefreshDecision {
  if (row === null) return 'invalid';
  if (row.revokedAt !== null) return 'reused';
  if (row.expiresAt.getTime() <= now.getTime()) return 'invalid';
  return 'rotate';
}
