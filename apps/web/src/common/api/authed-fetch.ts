import { coreFetch } from './core-api';

/** Where API clients get a bearer token. The auth feature registers it once. */
export interface AccessProvider {
  /** Current token, refreshed first when it is about to expire. `null` for a demo tab. */
  token: () => Promise<string | null>;
  /** Forces one refresh after a 401. `null` when the session is gone. */
  renew: () => Promise<string | null>;
}

let provider: AccessProvider | null = null;

/** Called by the auth feature. API clients never read the session store directly. */
export function configureAccess(next: AccessProvider): void {
  provider = next;
}

/**
 * Core-api request with a fresh bearer token.
 * A 401 refreshes the session once and repeats the request; the body must be reusable.
 */
export async function authedFetch(path: string, init: RequestInit = { method: 'GET' }): Promise<Response> {
  const token = provider === null ? null : await provider.token();
  const first = await coreFetch(path, init, token);
  if (first.status !== 401 || provider === null || token === null) return first;
  const renewed = await provider.renew();
  if (renewed === null) return first;
  return coreFetch(path, init, renewed);
}

/** JSON body of a successful response, or `null`. */
export async function readJson<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  return (await response.json()) as T;
}
