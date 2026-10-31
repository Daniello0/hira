import type { VoiceLanguage } from '../../enums/voice-language.enum';

/** A call session. It is not a chat. */
export interface CallSessionDto {
  id: string;
  startedAt: string;
  endedAt: string | null;
}

/** Body of `POST /api/v1/calls/{id}/turns`. */
export interface CreateCallTurnRequest {
  content: string;
  useMemory?: boolean;
  /** Language to reply in. Absent: the language of the phrase. */
  language?: VoiceLanguage;
  /** The user cut off the reply before this one: the words of it they heard. Empty: none. */
  interruptedAt?: string;
}

/** Answer of `POST /api/v1/speech/transcribe`. `language` is what the recognizer heard. */
export interface TranscriptDto {
  text: string;
  language: string | null;
}
