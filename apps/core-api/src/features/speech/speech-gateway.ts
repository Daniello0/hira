import { VOICES, MODEL_DOWNLOAD_TIMEOUT_MS, SPEECH_UNAVAILABLE_MESSAGE, SYNTHESIZE_TIMEOUT_MS, TRANSCRIBE_MODEL, TRANSCRIBE_TIMEOUT_MS } from './speech.constants';
import type { TranscriptDto, VoiceLanguage } from '@hira/contracts';

/** The speech container did not answer. */
export class SpeechUnavailableError extends Error {
  constructor() {
    super(SPEECH_UNAVAILABLE_MESSAGE);
    this.name = 'SpeechUnavailableError';
  }
}

export interface SpeechGateway {
  transcribe(audio: Buffer, language: VoiceLanguage | null): Promise<TranscriptDto>;
  synthesize(text: string, language: VoiceLanguage): Promise<Buffer>;
}

type Fetch = typeof fetch;

/** Speaks to the speech container through its OpenAI-compatible routes. A model not on the volume yet is fetched once. */
export function createSpeechGateway(baseUrl: string, request: Fetch = fetch): SpeechGateway {
  const withModel = async (model: string, call: () => Promise<Response>): Promise<Response> => {
    const first = await reachable(call);
    if (first.status !== 404) return first;
    await reachable(() => request(`${baseUrl}/v1/models/${model}`, { method: 'POST', signal: AbortSignal.timeout(MODEL_DOWNLOAD_TIMEOUT_MS) }));
    return reachable(call);
  };
  return {
    transcribe: async (audio, language) => {
      const response = await withModel(TRANSCRIBE_MODEL, () =>
        request(`${baseUrl}/v1/audio/transcriptions`, {
          method: 'POST',
          body: transcribeForm(audio, language),
          signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
        }),
      );
      if (!response.ok) throw new SpeechUnavailableError();
      const body = (await response.json()) as { text?: unknown; language?: unknown };
      return { text: typeof body.text === 'string' ? body.text.trim() : '', language: typeof body.language === 'string' ? body.language : null };
    },
    synthesize: async (text, language) => {
      const { model, voice } = VOICES[language];
      const response = await withModel(model, () =>
        request(`${baseUrl}/v1/audio/speech`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, voice, input: text, response_format: 'wav' }),
          signal: AbortSignal.timeout(SYNTHESIZE_TIMEOUT_MS),
        }),
      );
      if (!response.ok) throw new SpeechUnavailableError();
      return closedWav(Buffer.from(await response.arrayBuffer()));
    },
  };
}

async function reachable(call: () => Promise<Response>): Promise<Response> {
  try {
    return await call();
  } catch {
    throw new SpeechUnavailableError();
  }
}

function transcribeForm(audio: Buffer, language: VoiceLanguage | null): FormData {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'phrase.wav');
  form.append('model', TRANSCRIBE_MODEL);
  form.append('response_format', 'verbose_json');
  if (language !== null) form.append('language', language);
  return form;
}

/**
 * The container streams its WAV and leaves the sizes in the header open.
 * Browsers differ on such a file, so the real sizes are written before it goes out.
 */
export function closedWav(wav: Buffer): Buffer {
  const data = wav.indexOf('data', 12, 'latin1');
  if (wav.toString('latin1', 0, 4) !== 'RIFF' || data < 0 || data + 8 > wav.length) return wav;
  const out = Buffer.from(wav);
  out.writeUInt32LE(out.length - 8, 4);
  out.writeUInt32LE(out.length - data - 8, data + 4);
  return out;
}
