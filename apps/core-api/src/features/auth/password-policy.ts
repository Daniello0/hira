import { COMPROMISED_PASSWORDS } from './compromised-passwords';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './auth.constants';

/** Password rejected by the local policy. The HTTP layer maps it to 400. */
export class WeakPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeakPasswordError';
  }
}

/** Enforces the minimum length and the local compromised-password list. */
export function assertPasswordPolicy(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new WeakPasswordError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new WeakPasswordError(`Password must be at most ${PASSWORD_MAX_LENGTH} characters`);
  }
  if (COMPROMISED_PASSWORDS.has(password.toLowerCase())) {
    throw new WeakPasswordError('Password appears in a list of compromised passwords');
  }
}
