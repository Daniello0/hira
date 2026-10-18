import { CALL_NOT_FOUND_MESSAGE } from '../memory/memory.constants';

/** The call is missing or belongs to another account. */
export class CallMissingError extends Error {
  constructor() {
    super(CALL_NOT_FOUND_MESSAGE);
    this.name = 'CallMissingError';
  }
}
