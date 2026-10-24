const MS_PER_SECOND = 1_000;

/**
 * Seconds to wait from a rate-limit response: `Retry-After` (seconds or an HTTP date),
 * else OpenRouter's `X-RateLimit-Reset` (epoch milliseconds). Null when neither is usable.
 */
export function readRetryAfter(headers: Record<string, unknown> | undefined, nowMs: number = Date.now()): number | null {
  if (headers === undefined) return null;
  return fromRetryAfter(header(headers, 'retry-after'), nowMs) ?? fromReset(header(headers, 'x-ratelimit-reset'), nowMs);
}

function header(headers: Record<string, unknown>, name: string): string | null {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  const value = entry?.[1];
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function fromRetryAfter(value: string | null, nowMs: number): number | null {
  if (value === null) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, Math.ceil((at - nowMs) / MS_PER_SECOND)) : null;
}

function fromReset(value: string | null, nowMs: number): number | null {
  const resetMs = value === null ? Number.NaN : Number(value);
  if (!Number.isFinite(resetMs)) return null;
  return Math.max(0, Math.ceil((resetMs - nowMs) / MS_PER_SECOND));
}
