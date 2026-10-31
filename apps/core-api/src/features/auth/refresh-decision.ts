export interface RefreshState {
  revokedAt: Date | null;
  expiresAt: Date;
}

export type RefreshDecision = 'invalid' | 'reused' | 'rotate' | 'grace';

/** A second tab or a reload can present the token just replaced. That is not theft. */
export const REFRESH_GRACE_MS = 30_000;

/**
 * Decides what a presented refresh token means.
 * An expired token is invalid. A token replaced within the grace window gets a new one.
 * Any other revoked token is reuse and revokes the user's other sessions. Logout also expires
 * the row, so a logged-out token never gets the grace.
 * The schema has no separate family id: every active refresh token of the user is the family.
 */
export function decideRefresh(row: RefreshState | null, now: Date): RefreshDecision {
  if (row === null) return 'invalid';
  if (row.revokedAt !== null) return inGrace(row, now) ? 'grace' : 'reused';
  if (row.expiresAt.getTime() <= now.getTime()) return 'invalid';
  return 'rotate';
}

function inGrace(row: RefreshState, now: Date): boolean {
  if (row.revokedAt === null || row.expiresAt.getTime() <= now.getTime()) return false;
  return now.getTime() - row.revokedAt.getTime() < REFRESH_GRACE_MS;
}
