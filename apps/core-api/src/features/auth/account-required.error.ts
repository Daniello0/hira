import { ACCOUNT_REQUIRED_MESSAGE } from '../memory/memory.constants';

/** Demo cookie or anonymous caller on an account-only route. */
export class AccountRequiredError extends Error {
  constructor() {
    super(ACCOUNT_REQUIRED_MESSAGE);
    this.name = 'AccountRequiredError';
  }
}
