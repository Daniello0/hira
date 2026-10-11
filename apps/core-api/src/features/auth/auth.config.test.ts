import { describe, expect, it } from 'vitest';
import { readJwtSecret, readWebOrigin } from './auth.config';

const SECRET = 'a'.repeat(32);

describe('auth config', () => {
  it('rejects a missing or short JWT secret', () => {
    expect(() => readJwtSecret({})).toThrow(/JWT_SECRET/);
    expect(() => readJwtSecret({ JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('returns a long enough secret and the local web origin by default', () => {
    expect(readJwtSecret({ JWT_SECRET: SECRET })).toBe(SECRET);
    expect(readWebOrigin({})).toBe('http://localhost:3000');
    expect(readWebOrigin({ WEB_ORIGIN: ' https://hira.local ' })).toBe('https://hira.local');
  });
});
