import type { VoiceLanguage } from '@hira/contracts';
import { readForeignRemotePreference } from '../chat/foreign-remote-preference';

/** Body of one call turn. Foreign remote follows the chat switch stored in this browser. */
export function callTurnRequest(content: string, language: VoiceLanguage | null): { content: string; includeForeignRemote: boolean; language?: VoiceLanguage } {
  return { content, includeForeignRemote: readForeignRemotePreference(), ...(language === null ? {} : { language }) };
}
