interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult {
  isFinal: boolean;
  0?: RecognitionAlternative;
}

interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}

interface RecognitionErrorEvent {
  error: string;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => Recognition;

/** What the page hears from one recognition session. */
export interface ListenHandlers {
  onFinal: (text: string) => void;
  /** The browser ended the session on its own (silence, network). The page may listen again. */
  onEnd: () => void;
  /** The microphone is blocked; listening again would fail the same way. */
  onDenied: () => void;
}

const DENIED_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

/** True when this browser can turn speech into text. */
export function speechRecognitionAvailable(): boolean {
  return recognitionConstructor() !== null;
}

/** Starts one recognition session. `null` when the API is missing. */
export function listen(lang: string, handlers: ListenHandlers): { stop: () => void } | null {
  const Ctor = recognitionConstructor();
  if (Ctor === null) return null;
  const recognition = new Ctor();
  let stopped = false;
  let denied = false;
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.onresult = (event) => deliverFinal(event, handlers.onFinal);
  recognition.onerror = (event) => {
    if (!DENIED_ERRORS.has(event.error)) return;
    denied = true;
    handlers.onDenied();
  };
  recognition.onend = () => {
    if (!stopped && !denied) handlers.onEnd();
  };
  startSafely(recognition, handlers);
  return {
    stop: () => {
      stopped = true;
      recognition.stop();
    },
  };
}

/** Speaks assistant text in `lang`, then continues the call. */
export function speak(text: string, lang: string, onEnd: () => void): void {
  if (typeof window === 'undefined' || text.trim().length === 0) {
    onEnd();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/** Stops any in-progress voice. */
export function silence(): void {
  if (typeof window === 'undefined') return;
  window.speechSynthesis.cancel();
}

function startSafely(recognition: Recognition, handlers: ListenHandlers): void {
  try {
    recognition.start();
  } catch {
    handlers.onDenied();
  }
}

function recognitionConstructor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const host = window as Window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function deliverFinal(event: RecognitionEvent, onFinal: (text: string) => void): void {
  const result = event.results[event.results.length - 1];
  if (result?.isFinal) onFinal(result[0]?.transcript ?? '');
}
