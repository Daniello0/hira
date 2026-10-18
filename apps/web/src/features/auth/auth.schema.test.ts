import { describe, expect, it } from 'vitest';
import { loginSchema } from './auth.schema';

describe('loginSchema', () => {
  it('rejects a password shorter than 10 characters', async () => {
    await expect(loginSchema.validate({ email: 'ada@example.com', password: 'too-short' })).rejects.toThrow();
  });

  it('accepts a password of 10 characters', async () => {
    await expect(loginSchema.validate({ email: 'ada@example.com', password: 'long-enough' })).resolves.toBeTruthy();
  });
});
