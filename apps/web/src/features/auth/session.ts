import type { CurrentUserDto } from '@hira/contracts';
import { coreApiUrl, coreFetch } from '../../common/api/core-api';
import { REFRESH_LEAD_MS } from './auth.constants';
import { SessionStatus } from './session-status';

export interface AccessGrant {
  accessToken: string;
  expiresAt: number;
}

/** True when the access token is missing or inside the refresh window. */
export function shouldRefresh(expiresAt: number | null, now: number): boolean {
  if (expiresAt === null) return true;
  return expiresAt - now < REFRESH_LEAD_MS;
}

/** The API could not answer the refresh. That says nothing about the session. */
export class RefreshUnreachableError extends Error {
  constructor(status: number) {
    super(`Refresh answered ${status}`);
    this.name = 'RefreshUnreachableError';
  }
}

/** One refresh. A rejected cookie is an anonymous tab, not an error screen. A 5xx throws. */
export async function refreshAccess(
  request: typeof fetch,
  now: number,
): Promise<AccessGrant | null> {
  const response = await request(`${coreApiUrl()}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (response.status >= 500) throw new RefreshUnreachableError(response.status);
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
  if (!isRecord(body) || typeof body.accessToken !== 'string' || typeof body.expiresIn !== 'number')
    return null;
  return { accessToken: body.accessToken, expiresAt: now + body.expiresIn * 1000 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type TokenDecision =
  | { kind: 'current'; token: string | null }
  | { kind: 'refreshed'; grant: AccessGrant; user: CurrentUserDto }
  | { kind: 'stop' };

export interface TokenRequest {
  status: SessionStatus;
  accessToken: string | null;
  expiresAt: number | null;
  now: number;
  refresh: () => Promise<AccessGrant | null>;
  loadUser: (token: string) => Promise<CurrentUserDto | null>;
}

/** Demo sends as-is. An account inside the lead window refreshes first. */
export function accessForPost(
  status: SessionStatus,
  expiresAt: number | null,
  now: number,
): 'ready' | 'refresh' {
  if (status !== SessionStatus.Account) return 'ready';
  return shouldRefresh(expiresAt, now) ? 'refresh' : 'ready';
}

/** A rejected refresh can still use a token that has not expired. */
export function afterRefreshFailure(
  expiresAt: number | null,
  now: number,
): 'use-current' | 'sign-out' {
  if (expiresAt !== null && expiresAt > now) return 'use-current';
  return 'sign-out';
}

/** Bearer token for the next POST. A network failure keeps the current token. */
export async function tokenForRequest(input: TokenRequest): Promise<TokenDecision> {
  if (accessForPost(input.status, input.expiresAt, input.now) === 'ready') return current(input);
  const refreshed = await readRefresh(input);
  if (refreshed !== null) return refreshed;
  if (afterRefreshFailure(input.expiresAt, input.now) === 'use-current') return current(input);
  return { kind: 'stop' };
}

async function readRefresh(input: TokenRequest): Promise<TokenDecision | null> {
  try {
    const grant = await input.refresh();
    if (grant === null) return null;
    const user = await input.loadUser(grant.accessToken);
    if (user === null) return null;
    return { kind: 'refreshed', grant, user };
  } catch {
    return current(input);
  }
}

function current(input: TokenRequest): TokenDecision {
  return { kind: 'current', token: input.accessToken };
}
