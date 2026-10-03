export interface HostPort {
  host: string;
  port: number;
}

/**
 * Reads a host and port from a URL such as `postgresql://user:pass@postgres:5432/hira`.
 * Returns null when the value is missing or not a URL. A failed parse is a down dependency.
 */
export function readHostPort(rawUrl: string | undefined, defaultPort: number): HostPort | null {
  if (rawUrl === undefined || rawUrl.trim().length === 0) {
    return null;
  }
  const parsed = tryParseUrl(rawUrl);
  if (parsed === null || parsed.hostname.length === 0) {
    return null;
  }
  return toHostPort(parsed, defaultPort);
}

function tryParseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function toHostPort(parsed: URL, defaultPort: number): HostPort | null {
  const port = parsed.port.length > 0 ? Number(parsed.port) : defaultPort;
  if (!Number.isInteger(port)) {
    return null;
  }
  return { host: parsed.hostname, port };
}
