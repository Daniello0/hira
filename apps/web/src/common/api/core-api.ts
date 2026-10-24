/** Browser-facing core-api origin. The Next server uses `CORE_API_URL` for health only. */
export function coreApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_CORE_API_URL ?? 'http://localhost:4000';
  return configured.replace(/\/$/, '');
}

/** JSON request init. The browser still sends the refresh cookie. */
export function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/** `fetch` with the refresh cookie and, after login, the bearer token. */
export function coreFetch(path: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token !== null) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${coreApiUrl()}${path}`, { ...init, headers, credentials: 'include' });
}
