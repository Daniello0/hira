import type { MicHandlers } from './voice-session';

/** Served from `public/vad`; `scripts/copy-vad-assets.mjs` puts the files there at build time. */
const ASSET_PATH = '/vad/';

/** Long enough that a cough or a door does not cut Hira off. */
const MIN_SPEECH_MS = 300;
/** A pause this long ends the phrase. */
const PHRASE_PAUSE_MS = 800;
const PRE_SPEECH_PAD_MS = 300;

/** Opens the microphone with echo cancellation and finds speech in it with the Silero model. */
export async function startVadMic(handlers: MicHandlers): Promise<{ stop: () => void }> {
  // No microphone API over plain http: say so at once, before the model is fetched.
  if (navigator.mediaDevices === undefined) throw new Error('The browser gives no microphone here');
  const { MicVAD, utils } = await import('@ricky0123/vad-web');
  const vad = await MicVAD.new({
    model: 'v5',
    baseAssetPath: ASSET_PATH,
    onnxWASMBasePath: ASSET_PATH,
    startOnLoad: true,
    minSpeechMs: MIN_SPEECH_MS,
    redemptionMs: PHRASE_PAUSE_MS,
    preSpeechPadMs: PRE_SPEECH_PAD_MS,
    getStream: () =>
      navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      }),
    onSpeechRealStart: handlers.onSpeechStart,
    onSpeechEnd: (audio) => void handlers.onPhrase(new Blob([utils.encodeWAV(audio)], { type: 'audio/wav' })),
  });
  return { stop: () => void vad.destroy() };
}
