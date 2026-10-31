import type { TranscriptDto, VoiceLanguage } from '@hira/contracts';
import type { StreamResult } from '../chat/chat-stream';
import type { ParsedSse } from '../chat/sse-parser';
import { fallbackVoice, languageAfterHeard, languageAfterTyped, languageToRetry, type LanguageChoice } from './call-language';
import { CallPhase } from './call-phase';
import { beginListening, beginSpeaking, beginThinking, cutReply, onFinalTranscript, reduceCallEvent, type CallViewState } from './reduce-call';
import { speakableText, takeSentences } from './sentence-queue';

/** What the microphone tells the call. `onPhrase` gets a finished phrase as WAV. */
export interface MicHandlers {
  onSpeechStart: () => void;
  onPhrase: (audio: Blob) => Promise<void>;
}

export interface VoiceDeps {
  startMic: (handlers: MicHandlers) => Promise<{ stop: () => void }>;
  player: { play: (bytes: ArrayBuffer) => Promise<void>; stop: () => void; playedFraction: () => number };
  transcribe: (audio: Blob, language: VoiceLanguage | null) => Promise<TranscriptDto>;
  synthesize: (text: string, language: VoiceLanguage, signal: AbortSignal) => Promise<ArrayBuffer>;
  streamTurn: (text: string, language: VoiceLanguage | null, interruptedAt: string | null, signal: AbortSignal, onEvent: (event: ParsedSse) => void) => Promise<StreamResult>;
  commit: (update: (current: CallViewState) => CallViewState) => CallViewState;
  choice: () => LanguageChoice;
  browserLanguage: () => string | undefined;
  onMicBlocked: () => void;
  onVoiceTrouble: () => void;
}

const TURN_FAILED = 'Hira did not answer. Try again.';
/** Pieces given a voice in advance: the one playing and the one after it. */
const AHEAD_PIECES = 2;

/**
 * One live call: the microphone stays open, a phrase goes to the recognizer and on to Hira, and the
 * reply is spoken sentence by sentence while it is still being written. Speech during a reply cuts it,
 * and the next turn tells Hira where: only what was heard counts as said.
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
  private line: SpeechLine | null = null;
  /** What the user heard of the reply they cut off. Goes out with the next turn. */
  private interruptedAt: string | null = null;

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
    const choice = this.deps.choice();
    await this.runTurn(text, languageAfterTyped(choice, this.language, text), choice === 'auto' ? null : choice, generation);
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
      heard = await this.hear(audio, choice);
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
    const language = languageAfterHeard(choice, this.language, { language: heard.language, text });
    await this.runTurn(text, language, language, generation);
  }

  /** On Auto a language Hira cannot speak means a misheard phrase: it is read once more in the likely one. */
  private async hear(audio: Blob, choice: LanguageChoice): Promise<TranscriptDto> {
    if (choice !== 'auto') return this.deps.transcribe(audio, choice);
    const first = await this.deps.transcribe(audio, null);
    const retry = languageToRetry(first.language, this.language, this.deps.browserLanguage());
    if (retry === null) return first;
    return this.deps.transcribe(audio, retry).catch(() => first);
  }

  /** `replyIn` is what Hira is asked to answer in: a spoken phrase keeps the reply and the voice together. */
  private async runTurn(text: string, language: VoiceLanguage | null, replyIn: VoiceLanguage | null, generation: number): Promise<void> {
    this.language = language;
    this.deps.commit((current) => onFinalTranscript(current, `phrase-${generation}`, text));
    const signal = this.abort?.signal as AbortSignal;
    const speech = this.speechLine(generation, signal);
    this.line = speech;
    const interruptedAt = this.interruptedAt;
    this.interruptedAt = null;
    const result = await this.deps.streamTurn(text, replyIn, interruptedAt, signal, (event) => {
      if (!this.current(generation)) return;
      this.deps.commit((current) => reduceCallEvent(current, event));
      if (event.event === 'token') speech.add(tokenText(event));
    });
    if (!this.current(generation)) return;
    if (!result.opened) {
      this.interruptedAt = interruptedAt;
      this.line = null;
      speech.finish().catch(() => undefined);
      this.deps.commit((current) => ({ ...beginListening(current), notice: result.error?.message ?? TURN_FAILED }));
      return;
    }
    await speech.finish();
    if (!this.current(generation)) return;
    this.line = null;
    this.deps.commit(beginListening);
  }

  private speechLine(generation: number, signal: AbortSignal): SpeechLine {
    return new SpeechLine({
      synthesize: (sentence) => this.deps.synthesize(sentence, fallbackVoice(this.language, this.deps.browserLanguage()), signal),
      play: (bytes) => {
        this.deps.commit(beginSpeaking);
        return this.deps.player.play(bytes);
      },
      alive: () => this.current(generation),
      onTrouble: () => this.deps.onVoiceTrouble(),
    });
  }

  private nextWork(): number {
    this.cancelWork();
    this.abort = new AbortController();
    return this.generation;
  }

  private cancelWork(): void {
    this.rememberCut();
    this.generation += 1;
    this.abort?.abort();
    this.deps.player.stop();
  }

  /** Must run before the voice stops: afterwards nothing knows how far it got. */
  private rememberCut(): void {
    const line = this.line;
    this.line = null;
    if (line === null || !line.wrote) return;
    const heard = line.heard(this.deps.player.playedFraction());
    this.interruptedAt = heard;
    this.deps.commit((current) => cutReply(current, heard));
  }

  private current(generation: number): boolean {
    return !this.closed && generation === this.generation;
  }
}

interface SpeechLineDeps {
  synthesize: (sentence: string) => Promise<ArrayBuffer>;
  play: (bytes: ArrayBuffer) => Promise<void>;
  alive: () => boolean;
  onTrouble: () => void;
}

interface SpokenPiece {
  text: string;
  audio: Promise<ArrayBuffer> | null;
}

/**
 * Turns the stream of tokens into pieces of voice that play in order. The model writes faster than
 * she speaks, so a piece gets its sound only when its turn is near: the one playing and the one after it.
 * It also knows how far the voice got, which is what the user really heard.
 */
class SpeechLine {
  private buffer = '';
  private readonly pieces: SpokenPiece[] = [];
  private playing = 0;
  private sounding = false;
  private ended = false;
  private wake: (() => void) | null = null;
  private readonly run: Promise<void>;
  /** Tokens arrived, so core-api stores a reply for this turn. */
  wrote = false;

  constructor(private readonly deps: SpeechLineDeps) {
    this.run = this.playAll();
  }

  add(text: string): void {
    if (text.length > 0) this.wrote = true;
    const { sentences, rest } = takeSentences(this.buffer + text);
    this.buffer = rest;
    for (const sentence of sentences) this.queue(sentence);
  }

  finish(): Promise<void> {
    this.queue(this.buffer);
    this.buffer = '';
    this.ended = true;
    this.wake?.();
    return this.run;
  }

  /** The words already spoken. `fraction` is how much of the current piece has played. */
  heard(fraction: number): string {
    const done = this.pieces.slice(0, this.playing).map((piece) => piece.text);
    const current = this.pieces[this.playing];
    if (this.sounding && current !== undefined) done.push(cutAtWord(current.text, fraction));
    return done.join(' ').trim();
  }

  private queue(sentence: string): void {
    const text = speakableText(sentence);
    if (text.length === 0) return;
    this.pieces.push({ text, audio: null });
    this.prepareNear();
    this.wake?.();
  }

  private prepareNear(): void {
    for (const piece of this.pieces.slice(this.playing, this.playing + AHEAD_PIECES)) {
      if (piece.audio !== null) continue;
      piece.audio = this.deps.synthesize(piece.text);
      piece.audio.catch(() => undefined);
    }
  }

  private async playAll(): Promise<void> {
    while (this.deps.alive()) {
      const piece = this.pieces[this.playing];
      if (piece === undefined) {
        if (this.ended) return;
        await new Promise<void>((resolve) => {
          this.wake = resolve;
        });
        continue;
      }
      await this.playPiece(piece);
    }
  }

  private async playPiece(piece: SpokenPiece): Promise<void> {
    try {
      const bytes = await (piece.audio as Promise<ArrayBuffer>);
      if (!this.deps.alive()) return;
      this.sounding = true;
      await this.deps.play(bytes);
    } catch {
      if (this.deps.alive()) this.deps.onTrouble();
    }
    if (!this.deps.alive()) return;
    this.sounding = false;
    this.playing += 1;
    this.prepareNear();
  }
}

/** The part of a sentence heard so far, ending on a whole word. */
export function cutAtWord(text: string, fraction: number): string {
  if (fraction >= 1) return text;
  const end = Math.floor(text.length * Math.max(0, fraction));
  const space = text.lastIndexOf(' ', end);
  return space <= 0 ? '' : text.slice(0, space);
}

function joined(first: string, second: string): string {
  return `${first} ${second}`.trim();
}

function tokenText(event: ParsedSse): string {
  const data = event.data as { delta?: unknown } | null;
  return typeof data?.delta === 'string' ? data.delta : '';
}
