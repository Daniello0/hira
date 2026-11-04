import { PhraseDrafts } from './phrase-drafts';
import type { MicHandlers } from './voice-session';

/** Served from `public/vad`; `scripts/copy-vad-assets.mjs` puts the files there at build time. */
const ASSET_PATH = '/vad/';

/** Long enough that a cough or a door does not cut Hira off. */
const MIN_SPEECH_MS = 300;
/** A pause this long ends the phrase. */
const PHRASE_PAUSE_MS = 800;
const PRE_SPEECH_PAD_MS = 300;
/** The words heard so far go on screen about this often while the user talks. */
const DRAFT_EVERY_MS = 1_000;
/** After this much of a pause the phrase is read ahead, so the text is ready when the pause ends it. */
const PAUSE_READ_MS = 250;
/** The library's defaults, named here so the drafts see pauses exactly as the VAD does. */
const SPEECH_ABOVE = 0.3;
const QUIET_BELOW = 0.25;
/** The v5 model reads 512 samples at 16 kHz per frame. */
const FRAME_MS = 32;

/** Opens the microphone with echo cancellation and finds speech in it with the Silero model. */
export async function startVadMic(handlers: MicHandlers): Promise<{ stop: () => void }> {
  // No microphone API over plain http: say so at once, before the model is fetched.
  if (navigator.mediaDevices === undefined) throw new Error('The browser gives no microphone here');
  const { MicVAD, utils } = await import('@ricky0123/vad-web');
  const wav = (audio: Float32Array) => new Blob([utils.encodeWAV(audio)], { type: 'audio/wav' });
  const drafts = new PhraseDrafts(
    {
      padFrames: Math.floor(PRE_SPEECH_PAD_MS / FRAME_MS),
      draftEveryFrames: Math.floor(DRAFT_EVERY_MS / FRAME_MS),
      pauseFrames: Math.floor(PAUSE_READ_MS / FRAME_MS),
      speechAbove: SPEECH_ABOVE,
      quietBelow: QUIET_BELOW,
    },
    (audio, paused) => handlers.onDraft(wav(audio), paused),
  );
  const vad = await MicVAD.new({
    model: 'v5',
    baseAssetPath: ASSET_PATH,
    onnxWASMBasePath: ASSET_PATH,
    startOnLoad: true,
    minSpeechMs: MIN_SPEECH_MS,
    redemptionMs: PHRASE_PAUSE_MS,
    preSpeechPadMs: PRE_SPEECH_PAD_MS,
    positiveSpeechThreshold: SPEECH_ABOVE,
    negativeSpeechThreshold: QUIET_BELOW,
    getStream: () =>
      navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      }),
    onFrameProcessed: (probabilities, frame) => drafts.frame(probabilities.isSpeech, frame),
    onSpeechRealStart: () => {
      drafts.realStart();
      handlers.onSpeechStart();
    },
    onVADMisfire: () => drafts.reset(),
    onSpeechEnd: (audio) => void handlers.onPhrase(wav(audio), drafts.end()),
  });
  return { stop: () => void vad.destroy() };
}
