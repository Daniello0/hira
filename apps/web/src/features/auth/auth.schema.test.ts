import { describe, expect, it } from 'vitest';
import { loginSchema } from './auth.schema';

describe('loginSchema', () => {
  it('rejects a password shorter than 10 characters', async () => {
    await expect(loginSchema.validate({ email: 'ada@example.com', password: 'too-short' })).rejects.toThrow();
  });

  it('says what is wrong with the email', async () => {
    await expect(loginSchema.validate({ email: '', password: 'long-enough' })).rejects.toThrow('Enter your email');
    await expect(loginSchema.validate({ email: 'ada', password: 'long-enough' })).rejects.toThrow('Enter a valid email');
  });

  it('accepts a password of 10 characters', async () => {
    await expect(loginSchema.validate({ email: 'ada@example.com', password: 'long-enough' })).resolves.toBeTruthy();
  });
});
