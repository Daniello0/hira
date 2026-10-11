import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from './password.hasher';

describe('argon2id hasher', () => {
  it('hashes with the memory, time, and parallelism from the auth spec', async () => {
    const hasher = new Argon2PasswordHasher();
    const hashed = await hasher.hash('correct-horse');
    expect(hashed).toContain('$argon2id$');
    expect(hashed).toContain('m=65536,t=3,p=4');
    expect(await hasher.verify('correct-horse', hashed)).toBe(true);
    expect(await hasher.verify('wrong-password', hashed)).toBe(false);
  }, 20_000);
});
