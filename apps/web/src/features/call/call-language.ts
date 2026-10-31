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
/** Whisper mistakes a short Russian phrase for these. Hira has no voice for them, so Russian is the likely speech. */
const HEARD_AS_RUSSIAN = new Set(['pl', 'uk', 'be', 'bg', 'sr', 'hr', 'bs', 'cs', 'sk', 'sl', 'mk', 'kk']);

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

/** The language to hear a phrase again in, when the recognizer named one Hira has no voice for. Null when it named a known one. */
export function languageToRetry(heard: string | null, current: VoiceLanguage | null, browserLanguage: string | undefined): VoiceLanguage | null {
  if (heard === null || asVoiceLanguage(heard) !== null) return null;
  return HEARD_AS_RUSSIAN.has(heard.trim().toLowerCase()) ? VoiceLanguage.Russian : fallbackVoice(current, browserLanguage);
}

/** The voice to use before anything was said, from the browser's language. */
export function fallbackVoice(current: VoiceLanguage | null, browserLanguage: string | undefined): VoiceLanguage {
  return current ?? asVoiceLanguage(browserLanguage) ?? VoiceLanguage.English;
}
