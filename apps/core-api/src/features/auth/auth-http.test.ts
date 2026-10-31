import { afterEach, describe, expect, it } from 'vitest';
import { clearSessionCookieOptions, sessionCookieOptions } from './auth-http';

describe('session cookie flags', () => {
  const original = process.env.WEB_ORIGIN;

  afterEach(() => {
    if (original === undefined) delete process.env.WEB_ORIGIN;
    else process.env.WEB_ORIGIN = original;
  });

  it('marks the cookie Secure when the web app is served over https', () => {
    process.env.WEB_ORIGIN = 'https://hira.example.com';
    expect(sessionCookieOptions(60).secure).toBe(true);
    expect(clearSessionCookieOptions().secure).toBe(true);
  });

  it('leaves Secure off on http, where Safari would drop the cookie', () => {
    process.env.WEB_ORIGIN = 'http://localhost:3000';
    expect(sessionCookieOptions(60).secure).toBe(false);
    expect(clearSessionCookieOptions().secure).toBe(false);
  });

  it('keeps the other flags on either origin', () => {
    process.env.WEB_ORIGIN = 'http://localhost:3000';
    expect(sessionCookieOptions(60)).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/', maxAge: 60_000 });
  });
});
