import { MessageRole } from '@hira/contracts';
import type { Caption } from './reduce-call';

/** Voice language choice on the call screen. `Auto` follows what the user last said. */
export enum SpeechLanguage {
  Auto = 'auto',
  English = 'en-US',
  Russian = 'ru-RU',
}

export const SPEECH_LANGUAGE_LABELS: Record<SpeechLanguage, string> = {
  [SpeechLanguage.Auto]: 'Auto',
  [SpeechLanguage.English]: 'English',
  [SpeechLanguage.Russian]: 'Russian',
};

const CYRILLIC = /[Ѐ-ӿ]/;

/** BCP-47 tag for recognition: the choice, or Russian when the user's last phrase was Cyrillic. */
export function recognitionLang(choice: SpeechLanguage, captions: readonly Caption[]): string {
  if (choice !== SpeechLanguage.Auto) return choice;
  const lastUser = [...captions].reverse().find((caption) => caption.role === MessageRole.User);
  if (lastUser !== undefined) return langOfText(lastUser.content);
  return browserPrefersRussian() ? SpeechLanguage.Russian : SpeechLanguage.English;
}

/** BCP-47 tag for the voice: the choice, or the script of the text being spoken. */
export function synthesisLang(choice: SpeechLanguage, text: string): string {
  if (choice !== SpeechLanguage.Auto) return choice;
  return langOfText(text);
}

function langOfText(text: string): string {
  return CYRILLIC.test(text) ? SpeechLanguage.Russian : SpeechLanguage.English;
}

function browserPrefersRussian(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.language.toLowerCase().startsWith('ru');
}
