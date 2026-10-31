import type { TranscriptDto, VoiceLanguage } from '@hira/contracts';
import type { StreamResult } from '../chat/chat-stream';
import type { ParsedSse } from '../chat/sse-parser';
import { fallbackVoice, languageAfterHeard, languageAfterTyped, type LanguageChoice } from './call-language';
import { CallPhase } from './call-phase';
import { beginListening, beginSpeaking, beginThinking, onFinalTranscript, reduceCallEvent, type CallViewState } from './reduce-call';
import { speakableText, takeSentences } from './sentence-queue';

/** What the microphone tells the call. `onPhrase` gets a finished phrase as WAV. */
export interface MicHandlers {
  onSpeechStart: () => void;
  onPhrase: (audio: Blob) => Promise<void>;
}

export interface VoiceDeps {
  startMic: (handlers: MicHandlers) => Promise<{ stop: () => void }>;
  player: { play: (bytes: ArrayBuffer) => Promise<void>; stop: () => void };
  transcribe: (audio: Blob, language: VoiceLanguage | null) => Promise<TranscriptDto>;
  synthesize: (text: string, language: VoiceLanguage, signal: AbortSignal) => Promise<ArrayBuffer>;
  streamTurn: (text: string, language: VoiceLanguage | null, signal: AbortSignal, onEvent: (event: ParsedSse) => void) => Promise<StreamResult>;
  commit: (update: (current: CallViewState) => CallViewState) => CallViewState;
  choice: () => LanguageChoice;
  browserLanguage: () => string | undefined;
  onMicBlocked: () => void;
  onVoiceTrouble: () => void;
}

const TURN_FAILED = 'Hira did not answer. Try again.';

/**
 * One live call: the microphone stays open, a phrase goes to the recognizer and on to Hira, and the
 * reply is spoken sentence by sentence while it is still being written. Speech during a reply cuts it.
 */
export class VoiceSession {
  /** Bumped by every new phrase and interruption. Work started under an older value is dropped. */
  private generation = 0;
  private language: VoiceLanguage | null = null;
  private mic: { stop: () => void } | null = null;
  private abort: AbortController | null = null;
  private closed = false;
  /** A phrase whose reading was overtaken by more speech. It opens the next phrase. */
  private carried = '';

  constructor(private readonly deps: VoiceDeps) {}

  /** Opens the microphone. A blocked one leaves the call listening to typed phrases. */
  async open(): Promise<void> {
    this.deps.commit(beginListening);
    try {
      const mic = await this.deps.startMic({ onSpeechStart: () => this.onSpeechStart(), onPhrase: (audio) => this.onPhrase(audio) });
      if (this.closed) mic.stop();
      else this.mic = mic;
    } catch {
      this.deps.onMicBlocked();
    }
  }

  /** Ends the call. Nothing runs after this. */
  close(): void {
    this.closed = true;
    this.cancelWork();
    this.mic?.stop();
    this.mic = null;
  }

  /** A typed phrase, for a browser without a microphone or a service that is down. */
  async sayTyped(text: string): Promise<void> {
    const generation = this.nextWork();
    await this.runTurn(text, languageAfterTyped(this.deps.choice(), this.language, text), generation);
  }

  private onSpeechStart(): void {
    if (this.closed) return;
    const { phase } = this.deps.commit((current) => current);
    if (phase !== CallPhase.Thinking && phase !== CallPhase.Speaking) return;
    this.cancelWork();
    this.deps.commit(beginListening);
  }

  private async onPhrase(audio: Blob): Promise<void> {
    if (this.closed) return;
    const generation = this.nextWork();
    this.deps.commit(beginThinking);
    const choice = this.deps.choice();
    let heard: TranscriptDto;
    try {
      heard = await this.deps.transcribe(audio, choice === 'auto' ? null : choice);
    } catch {
      if (this.current(generation)) {
        this.deps.onVoiceTrouble();
        this.deps.commit(beginListening);
      }
      return;
    }
    if (!this.current(generation)) {
      this.carried = joined(this.carried, heard.text);
      return;
    }
    const text = joined(this.carried, heard.text);
    this.carried = '';
    if (text.length === 0) {
      this.deps.commit(beginListening);
      return;
    }
    await this.runTurn(text, languageAfterHeard(choice, this.language, { language: heard.language, text }), generation);
  }

  private async runTurn(text: string, language: VoiceLanguage | null, generation: number): Promise<void> {
    this.language = language;
    this.deps.commit((current) => onFinalTranscript(current, crypto.randomUUID(), text));
    const signal = this.abort?.signal as AbortSignal;
    const speech = new SpeechLine((sentence) => this.speak(sentence, generation, signal));
    const chosen = this.deps.choice();
    const result = await this.deps.streamTurn(text, chosen === 'auto' ? null : chosen, signal, (event) => {
      if (!this.current(generation)) return;
      this.deps.commit((current) => reduceCallEvent(current, event));
      if (event.event === 'token') speech.add(tokenText(event));
    });
    if (!this.current(generation)) return;
    if (!result.opened) {
      this.deps.commit((current) => ({ ...beginListening(current), notice: result.error?.message ?? TURN_FAILED }));
      return;
    }
    await speech.finish();
    if (this.current(generation)) this.deps.commit(beginListening);
  }

  /** Starts the voice at once, so a later sentence is ready when the one before ends. */
  private speak(sentence: string, generation: number, signal: AbortSignal): () => Promise<void> {
    const audio = this.deps.synthesize(sentence, fallbackVoice(this.language, this.deps.browserLanguage()), signal);
    audio.catch(() => undefined);
    return async () => {
      try {
        const bytes = await audio;
        if (!this.current(generation)) return;
        this.deps.commit(beginSpeaking);
        await this.deps.player.play(bytes);
      } catch {
        if (this.current(generation)) this.deps.onVoiceTrouble();
      }
    };
  }

  private nextWork(): number {
    this.cancelWork();
    this.abort = new AbortController();
    return this.generation;
  }

  private cancelWork(): void {
    this.generation += 1;
    this.abort?.abort();
    this.deps.player.stop();
  }

  private current(generation: number): boolean {
    return !this.closed && generation === this.generation;
  }
}

/** Turns the stream of tokens into pieces of voice that play in order. */
class SpeechLine {
  private buffer = '';
  private line: Promise<void> = Promise.resolve();

  constructor(private readonly start: (sentence: string) => () => Promise<void>) {}

  add(text: string): void {
    const { sentences, rest } = takeSentences(this.buffer + text);
    this.buffer = rest;
    for (const sentence of sentences) this.queue(sentence);
  }

  finish(): Promise<void> {
    this.queue(this.buffer);
    this.buffer = '';
    return this.line;
  }

  private queue(sentence: string): void {
    const spoken = speakableText(sentence);
    if (spoken.length === 0) return;
    const play = this.start(spoken);
    this.line = this.line.then(play);
  }
}

function joined(first: string, second: string): string {
  return `${first} ${second}`.trim();
}

function tokenText(event: ParsedSse): string {
  const data = event.data as { delta?: unknown } | null;
  return typeof data?.delta === 'string' ? data.delta : '';
}
