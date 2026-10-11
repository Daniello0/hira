import type { RefreshDecision, RefreshState } from './refresh-decision';

export const REFRESH_TOKEN_STORE = Symbol('REFRESH_TOKEN_STORE');

export interface ClientMeta {
  ip: string | null;
  userAgent: string | null;
}

export type RotateResult =
  | { decision: 'invalid' }
  | { decision: 'reused'; userId: string }
  | { decision: 'rotate'; userId: string; refreshToken: string };

export interface RefreshTokenStore {
  /** Persists a new refresh token and returns the raw cookie value. */
  issue(userId: string, now: Date, meta: ClientMeta): Promise<string>;
  /**
   * Rotates a presented token.
   * Reuse of a revoked token revokes every active token of that user.
   */
  rotate(rawToken: string, now: Date, meta: ClientMeta): Promise<RotateResult>;
  /** Marks one active token revoked. Does not treat a second logout as theft. */
  revokeIfActive(rawToken: string, now: Date): Promise<void>;
}

export type { RefreshDecision, RefreshState };
