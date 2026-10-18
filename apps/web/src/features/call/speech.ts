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

interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => Recognition;

/** True when this browser can turn speech into text. */
export function speechRecognitionAvailable(): boolean {
  return recognitionConstructor() !== null;
}

/** Starts one recognition session. `null` when the API is missing. */
export function listen(onFinal: (text: string) => void): { stop: () => void } | null {
  const Ctor = recognitionConstructor();
  if (Ctor === null) return null;
  const recognition = new Ctor();
  recognition.lang = navigator.language;
  recognition.interimResults = true;
  recognition.onresult = (event) => deliverFinal(event, onFinal);
  recognition.start();
  return { stop: () => recognition.stop() };
}

/** Speaks assistant text, then continues the call. */
export function speak(text: string, onEnd: () => void): void {
  if (typeof window === 'undefined' || text.trim().length === 0) {
    onEnd();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onend = onEnd;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/** Stops any in-progress voice. */
export function silence(): void {
  if (typeof window === 'undefined') return;
  window.speechSynthesis.cancel();
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
