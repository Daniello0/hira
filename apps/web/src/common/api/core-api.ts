const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Browser-facing core-api origin. The Next server uses `CORE_API_URL` for health only. */
export function coreApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_CORE_API_URL ?? 'http://localhost:4000';
  return apiUrlForPage(configured, typeof window === 'undefined' ? null : window.location);
}

type PageLocation = Pick<Location, 'hostname' | 'protocol' | 'origin'>;

/**
 * On a phone `localhost` is the phone itself, so a loopback API address follows the page. Over https the
 * proxy serves the API at the page's own address (`infra/caddy/Caddyfile`); over http it is the same host on the API port.
 */
export function apiUrlForPage(configured: string, page: PageLocation | null): string {
  const trimmed = configured.replace(/\/$/, '');
  const url = new URL(trimmed);
  if (page === null || LOOPBACK.has(page.hostname) && page.protocol === 'http:' || !LOOPBACK.has(url.hostname)) return trimmed;
  if (page.protocol === 'https:') return page.origin;
  url.hostname = page.hostname;
  return url.toString().replace(/\/$/, '');
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
