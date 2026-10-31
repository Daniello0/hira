import { VoiceLanguage } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { fallbackVoice, languageAfterHeard, languageAfterTyped } from './call-language';

const long = 'Найди мне работу в Минске';

describe('call language', () => {
  it('follows the language the recognizer heard, in all five', () => {
    for (const language of Object.values(VoiceLanguage)) {
      expect(languageAfterHeard('auto', null, { language, text: long })).toBe(language);
    }
    expect(languageAfterHeard('auto', VoiceLanguage.English, { language: 'ru', text: long })).toBe(VoiceLanguage.Russian);
  });

  it('does not switch on a short phrase', () => {
    expect(languageAfterHeard('auto', VoiceLanguage.Russian, { language: 'en', text: 'ok' })).toBe(VoiceLanguage.Russian);
  });

  it('takes a short phrase when nothing was said yet', () => {
    expect(languageAfterHeard('auto', null, { language: 'de', text: 'Hallo' })).toBe(VoiceLanguage.German);
  });

  it('keeps the language when it hears one Hira has no voice for', () => {
    expect(languageAfterHeard('auto', VoiceLanguage.French, { language: 'it', text: long })).toBe(VoiceLanguage.French);
  });

  it('lets the menu win', () => {
    expect(languageAfterHeard(VoiceLanguage.Spanish, null, { language: 'ru', text: long })).toBe(VoiceLanguage.Spanish);
    expect(languageAfterTyped(VoiceLanguage.Spanish, null, 'привет')).toBe(VoiceLanguage.Spanish);
  });

  it('reads Cyrillic from typed text and otherwise keeps the language', () => {
    expect(languageAfterTyped('auto', VoiceLanguage.German, 'привет')).toBe(VoiceLanguage.Russian);
    expect(languageAfterTyped('auto', VoiceLanguage.German, 'hello')).toBe(VoiceLanguage.German);
  });

  it('falls back to the browser language, then English', () => {
    expect(fallbackVoice(null, 'fr-FR')).toBe(VoiceLanguage.French);
    expect(fallbackVoice(null, 'it-IT')).toBe(VoiceLanguage.English);
    expect(fallbackVoice(VoiceLanguage.German, 'fr-FR')).toBe(VoiceLanguage.German);
  });
});
