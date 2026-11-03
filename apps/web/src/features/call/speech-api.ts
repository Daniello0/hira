import type { TranscriptDto, VoiceLanguage } from '@hira/contracts';
import { authedFetch } from '../../common/api/authed-fetch';
import { jsonRequest } from '../../common/api/core-api';

/** A spoken phrase as text. Throws when the voice service cannot answer. A `draft` is read only by the fast cloud ear. */
export async function transcribePhrase(audio: Blob, language: VoiceLanguage | null, draft = false): Promise<TranscriptDto> {
  const body = new FormData();
  body.append('audio', audio, 'phrase.wav');
  if (language !== null) body.append('language', language);
  if (draft) body.append('draft', 'true');
  const response = await authedFetch('/api/v1/speech/transcribe', { method: 'POST', body });
  if (!response.ok) throw new Error(`Transcribe answered ${response.status}`);
  return (await response.json()) as TranscriptDto;
}

/** Hira's voice saying a text. Throws when the voice service cannot answer. */
export async function synthesizeSpeech(text: string, language: VoiceLanguage, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await authedFetch('/api/v1/speech/synthesize', { ...jsonRequest('POST', { text, language }), signal });
  if (!response.ok) throw new Error(`Synthesize answered ${response.status}`);
  return response.arrayBuffer();
}
