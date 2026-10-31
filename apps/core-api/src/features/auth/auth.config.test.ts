import { describe, expect, it } from 'vitest';
import { readJwtSecret, readWebOrigins } from './auth.config';

const SECRET = 'a'.repeat(32);

describe('auth config', () => {
  it('rejects a missing or short JWT secret', () => {
    expect(() => readJwtSecret({})).toThrow(/JWT_SECRET/);
    expect(() => readJwtSecret({ JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('returns a long enough secret and the local web origin by default', () => {
    expect(readJwtSecret({ JWT_SECRET: SECRET })).toBe(SECRET);
    expect(readWebOrigins({})).toEqual(['http://localhost:3000']);
    expect(readWebOrigins({ WEB_ORIGIN: ' https://hira.local ' })).toEqual(['https://hira.local']);
  });

  it('allows several web origins, for a phone on the local network', () => {
    expect(readWebOrigins({ WEB_ORIGIN: 'http://localhost:3000, http://192.168.1.39:3000,' })).toEqual(['http://localhost:3000', 'http://192.168.1.39:3000']);
  });
});
