import type { VoiceLanguage } from '@hira/contracts';
import { readForeignRemotePreference } from '../chat/foreign-remote-preference';

/** Body of one call turn. Foreign remote follows the chat switch stored in this browser. */
export function callTurnRequest(
  content: string,
  language: VoiceLanguage | null,
  interruptedAt: string | null = null,
): { content: string; includeForeignRemote: boolean; language?: VoiceLanguage; interruptedAt?: string } {
  return {
    content,
    includeForeignRemote: readForeignRemotePreference(),
    ...(language === null ? {} : { language }),
    ...(interruptedAt === null ? {} : { interruptedAt }),
  };
}
