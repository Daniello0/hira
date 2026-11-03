import { z } from 'zod';
import { OPENROUTER_TRANSCRIPTION_PATH, TRANSCRIBE_MODEL, TRANSCRIBE_TIMEOUT_MS } from '../llm/llm.constants';
import { reachable, upstreamError } from './voice-upstream';

const transcribeSchema = z.object({
  audio: z.instanceof(Buffer).refine((audio) => audio.length > 0, 'audio is required'),
  language: z.string().trim().min(2).max(8).nullable(),
});

export type TranscribeRequest = z.infer<typeof transcribeSchema>;

/** A phrase as text, with the language heard as a code such as `ru`. */
export interface Transcript {
  text: string;
  language: string | null;
}

/** Some providers name the language in full. Hira speaks in codes; the Slavic ones matter for a misheard Russian phrase. */
const LANGUAGE_CODES: Readonly<Record<string, string>> = {
  russian: 'ru',
  english: 'en',
  spanish: 'es',
  german: 'de',
  french: 'fr',
  ukrainian: 'uk',
  belarusian: 'be',
  polish: 'pl',
  bulgarian: 'bg',
  serbian: 'sr',
  croatian: 'hr',
  bosnian: 'bs',
  czech: 'cs',
  slovak: 'sk',
  slovenian: 'sl',
  macedonian: 'mk',
  kazakh: 'kk',
  italian: 'it',
  portuguese: 'pt',
  dutch: 'nl',
  turkish: 'tr',
  chinese: 'zh',
  japanese: 'ja',
  korean: 'ko',
  arabic: 'ar',
};

/** Reads `POST /internal/v1/transcribe`: the WAV as the body, `?language=` when the user chose one. */
export function parseTranscribeRequest(audio: unknown, language: unknown): TranscribeRequest {
  return transcribeSchema.parse({ audio: Buffer.isBuffer(audio) ? audio : Buffer.alloc(0), language: typeof language === 'string' ? language : null });
}

/** One spoken phrase as text from OpenRouter. The caller keeps a recognizer of its own for when this fails. */
export function createTranscriber(config: { apiKey: string; baseUrl: string }, request: typeof fetch = fetch) {
  return async ({ audio, language }: TranscribeRequest): Promise<Transcript> => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'phrase.wav');
    form.append('model', TRANSCRIBE_MODEL);
    form.append('response_format', 'verbose_json');
    if (language !== null) form.append('language', language);
    const response = await reachable(() =>
      request(`${config.baseUrl.replace(/\/$/, '')}${OPENROUTER_TRANSCRIPTION_PATH}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
      }),
    );
    if (!response.ok) throw upstreamError();
    const body = (await response.json()) as { text?: unknown; language?: unknown };
    return { text: typeof body.text === 'string' ? body.text.trim() : '', language: languageCode(body.language) };
  };
}

/** `ru` for `ru`, `Russian` or `russian`; an unknown name stays as it came, in lower case. */
export function languageCode(heard: unknown): string | null {
  if (typeof heard !== 'string' || heard.trim().length === 0) return null;
  const name = heard.trim().toLowerCase();
  return LANGUAGE_CODES[name] ?? name;
}
