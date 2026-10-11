import { describe, expect, it } from 'vitest';
import { assertPasswordPolicy, WeakPasswordError } from './password-policy';

describe('password policy', () => {
  it('accepts a long password that is not on the local list', () => {
    expect(() => assertPasswordPolicy('correct-horse')).not.toThrow();
  });

  it('rejects fewer than 10 characters', () => {
    expect(() => assertPasswordPolicy('short-pw')).toThrow(WeakPasswordError);
  });

  it('rejects more than 128 characters', () => {
    expect(() => assertPasswordPolicy('a'.repeat(129))).toThrow(/at most 128/);
  });

  it('rejects a common password regardless of case', () => {
    expect(() => assertPasswordPolicy('Password1234')).toThrow(/compromised/);
  });
});
