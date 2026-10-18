import { describe, expect, it } from 'vitest';
import { readApiMessage } from './read-api-message';

describe('readApiMessage', () => {
  it('reads the message from an error body', async () => {
    const response = Response.json({ message: 'Email is taken' });
    await expect(readApiMessage(response, 'Registration failed')).resolves.toBe('Email is taken');
  });

  it('uses the fallback when the body is not JSON', async () => {
    const response = new Response('nope', { status: 500 });
    await expect(readApiMessage(response, 'Sign-in failed')).resolves.toBe('Sign-in failed');
  });
});
