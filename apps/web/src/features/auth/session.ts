import type { CurrentUserDto } from '@hira/contracts';
import { coreApiUrl, coreFetch } from '../../common/api/core-api';
import { REFRESH_LEAD_MS } from './auth.constants';

export interface AccessGrant {
  accessToken: string;
  expiresAt: number;
}

/** True when the access token is missing or inside the refresh window. */
export function shouldRefresh(expiresAt: number | null, now: number): boolean {
  if (expiresAt === null) return true;
  return expiresAt - now < REFRESH_LEAD_MS;
}

/** One refresh. A failed cookie is an anonymous tab, not an error screen. */
export async function refreshAccess(request: typeof fetch, now: number): Promise<AccessGrant | null> {
  const response = await request(`${coreApiUrl()}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (!response.ok) return null;
  return grant(await response.json(), now);
}

/** A 401 may be retried only when this turn is not already stored. */
export function shouldRepeatPost(status: number, alreadyStored: boolean): boolean {
  return status === 401 && !alreadyStored;
}

/** Account behind a fresh access token. */
export async function loadMe(token: string): Promise<CurrentUserDto | null> {
  const response = await coreFetch('/api/v1/auth/me', { method: 'GET' }, token);
  if (!response.ok) return null;
  return (await response.json()) as CurrentUserDto;
}

function grant(body: unknown, now: number): AccessGrant | null {
  if (!isRecord(body) || typeof body.accessToken !== 'string' || typeof body.expiresIn !== 'number') return null;
  return { accessToken: body.accessToken, expiresAt: now + body.expiresIn * 1000 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
