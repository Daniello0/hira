import type { Caller } from '../chat/resolve-actor';
import { AccountRequiredError } from './account-required.error';

/** Registered user id. A demo cookie is not an account. */
export function requireUserId(caller: Caller): string {
  if (caller.kind !== 'user') throw new AccountRequiredError();
  return caller.userId;
}
