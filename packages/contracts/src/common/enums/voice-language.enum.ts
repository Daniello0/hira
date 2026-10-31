/** Languages Hira can hear and speak on a call. */
export enum VoiceLanguage {
  Russian = 'ru',
  English = 'en',
  Spanish = 'es',
  German = 'de',
  French = 'fr',
}

/** The voice language behind a code like `ru` or `ru-RU`, or null when Hira has no voice for it. */
export function asVoiceLanguage(code: string | null | undefined): VoiceLanguage | null {
  const base = code?.trim().toLowerCase().split(/[-_]/)[0];
  return Object.values(VoiceLanguage).find((language) => language === base) ?? null;
}
