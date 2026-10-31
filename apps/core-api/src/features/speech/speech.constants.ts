import { VoiceLanguage } from '@hira/contracts';

export const SPEECH_GATEWAY = Symbol('SPEECH_GATEWAY');
export const DEFAULT_SPEECH_URL = 'http://127.0.0.1:8000';

/** Fast enough on a CPU for a phrase in about three seconds; it tells the five languages apart. */
export const TRANSCRIBE_MODEL = 'Systran/faster-whisper-base';

/** Hira's voice: one person across all five languages (MAI-Voice-2.1-Flash through OpenRouter, ADR-050). */
export const CLOUD_VOICES: Readonly<Record<VoiceLanguage, string>> = {
  [VoiceLanguage.Russian]: 'ru-RU-Harper:MAI-Voice-2.1-Flash',
  [VoiceLanguage.English]: 'en-US-Harper:MAI-Voice-2.1-Flash',
  [VoiceLanguage.Spanish]: 'es-MX-Harper:MAI-Voice-2.1-Flash',
  [VoiceLanguage.German]: 'de-DE-Harper:MAI-Voice-2.1-Flash',
  [VoiceLanguage.French]: 'fr-FR-Harper:MAI-Voice-2.1-Flash',
};
export const CLOUD_AUDIO_TYPE = 'audio/mpeg';
export const LOCAL_AUDIO_TYPE = 'audio/wav';
/** A little over llm-service's own limit, so its answer arrives first. */
export const CLOUD_VOICE_TIMEOUT_MS = 9_000;

/** The local voice, for when the cloud one fails. All are female; Wiki/10 ADR-045 records how that was checked. */
export const VOICES: Readonly<Record<VoiceLanguage, { model: string; voice: string }>> = {
  [VoiceLanguage.Russian]: { model: 'speaches-ai/piper-ru_RU-irina-medium', voice: 'irina' },
  [VoiceLanguage.English]: { model: 'speaches-ai/piper-en_US-amy-medium', voice: 'amy' },
  [VoiceLanguage.Spanish]: { model: 'speaches-ai/piper-es_MX-claude-high', voice: 'claude' },
  [VoiceLanguage.German]: { model: 'speaches-ai/piper-de_DE-kerstin-low', voice: 'kerstin' },
  [VoiceLanguage.French]: { model: 'speaches-ai/piper-fr_FR-siwis-medium', voice: 'siwis' },
};

export const TRANSCRIBE_TIMEOUT_MS = 60_000;
export const SYNTHESIZE_TIMEOUT_MS = 30_000;
/** A model missing from the volume is fetched once. A few hundred megabytes at most. */
export const MODEL_DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
export const AUDIO_MAX_BYTES = 10 * 1024 * 1024;
export const SPEECH_TEXT_MAX_CHARS = 2_000;

export const SPEECH_UNAVAILABLE = 'SPEECH_UNAVAILABLE';
export const SPEECH_UNAVAILABLE_MESSAGE = 'The voice service is unavailable';
