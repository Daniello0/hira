import { ADMIN_REQUIRED_MESSAGE } from './admin.constants';

/** The account exists but is not an administrator. */
export class AdminRequiredError extends Error {
  constructor() {
    super(ADMIN_REQUIRED_MESSAGE);
    this.name = 'AdminRequiredError';
  }
}
