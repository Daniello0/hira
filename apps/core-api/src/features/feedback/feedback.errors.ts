import { MESSAGE_NOT_FOUND_MESSAGE } from './feedback.constants';

/** The message is missing or sits in another account's chat. */
export class MessageMissingError extends Error {
  constructor() {
    super(MESSAGE_NOT_FOUND_MESSAGE);
    this.name = 'MessageMissingError';
  }
}
