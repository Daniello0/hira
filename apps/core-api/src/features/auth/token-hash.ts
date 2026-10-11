import { createHash, randomBytes } from 'node:crypto';
import { REFRESH_TOKEN_TTL_SECONDS } from './auth.constants';

/** SHA-256 hex. The raw refresh token is never stored. */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** 32 random bytes, base64url, used as the refresh cookie value. */
export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Absolute expiry for a refresh token issued at `now`. */
export function refreshExpiry(now: Date): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}
