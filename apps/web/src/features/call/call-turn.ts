import { readForeignRemotePreference } from '../chat/foreign-remote-preference';

/** Body of one call turn. Foreign remote follows the chat switch stored in this browser. */
export function callTurnRequest(content: string): { content: string; includeForeignRemote: boolean } {
  return { content, includeForeignRemote: readForeignRemotePreference() };
}
