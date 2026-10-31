import { VoiceLanguage, asVoiceLanguage } from '@hira/contracts';

/** Voice language choice on the call screen. `auto` follows what the user last said. */
export type LanguageChoice = 'auto' | VoiceLanguage;

export const LANGUAGE_CHOICE_LABELS: Readonly<Record<LanguageChoice, string>> = {
  auto: 'Auto',
  [VoiceLanguage.Russian]: 'Russian',
  [VoiceLanguage.English]: 'English',
  [VoiceLanguage.Spanish]: 'Spanish',
  [VoiceLanguage.German]: 'German',
  [VoiceLanguage.French]: 'French',
};

/** A phrase shorter than this ("да", "ok") says too little to change the language. */
const SHORT_PHRASE_CHARS = 12;
const CYRILLIC = /[Ѐ-ӿ]/;

/** Language of the reply after a spoken phrase. The menu wins; a short phrase keeps the language. */
export function languageAfterHeard(choice: LanguageChoice, current: VoiceLanguage | null, heard: { language: string | null; text: string }): VoiceLanguage | null {
  if (choice !== 'auto') return choice;
  const detected = asVoiceLanguage(heard.language);
  if (detected === null) return current;
  if (current !== null && heard.text.trim().length < SHORT_PHRASE_CHARS) return current;
  return detected;
}

/** Language of the reply after a typed phrase, which has no recognizer behind it. */
export function languageAfterTyped(choice: LanguageChoice, current: VoiceLanguage | null, text: string): VoiceLanguage | null {
  if (choice !== 'auto') return choice;
  return CYRILLIC.test(text) ? VoiceLanguage.Russian : current;
}

/** The voice to use before anything was said, from the browser's language. */
export function fallbackVoice(current: VoiceLanguage | null, browserLanguage: string | undefined): VoiceLanguage {
  return current ?? asVoiceLanguage(browserLanguage) ?? VoiceLanguage.English;
}
