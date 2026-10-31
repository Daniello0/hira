import { pieceGain } from './loudness';

/** The part of `AudioContext` the player uses. */
export interface PlayerContext {
  currentTime: number;
  destination: unknown;
  state: string;
  resume(): Promise<void>;
  close(): Promise<void>;
  decodeAudioData(bytes: ArrayBuffer): Promise<PlayerBuffer>;
  createBufferSource(): PlayerSource;
  createGain(): PlayerGain;
}

export interface PlayerBuffer {
  duration: number;
  sampleRate: number;
  getChannelData(channel: number): ArrayLike<number>;
}

export interface PlayerSource {
  buffer: unknown;
  onended: (() => void) | null;
  connect(destination: unknown): void;
  start(when: number): void;
  stop(when?: number): void;
}

export interface PlayerGain {
  gain: {
    setValueAtTime(value: number, at: number): void;
    linearRampToValueAtTime(value: number, at: number): void;
    cancelScheduledValues(at: number): void;
  };
  connect(destination: unknown): void;
}

/** Breath between two sentences, so they do not run into each other. */
const SENTENCE_PAUSE_SECONDS = 0.22;
/** Short enough not to be heard as a fade, long enough to remove the click at a cut. */
const FADE_SECONDS = 0.012;

interface Piece {
  source: PlayerSource;
  gain: PlayerGain;
  level: number;
  startAt: number;
  duration: number;
}

/**
 * Plays Hira's voice through the page, one piece after another, so the browser's echo canceller
 * knows the sound and a phrase can be cut at once. Every piece is brought to one level; how loud
 * that is on the speaker is left to the device's own volume.
 */
export class VoicePlayer {
  private readonly pieces: Piece[] = [];
  private endsAt = 0;
  /** Bumped by `stop`. A piece still decoding from before it stays silent. */
  private stops = 0;
  private closed = false;

  constructor(private readonly context: PlayerContext) {}

  /** Must run inside the click that starts the call, or Safari keeps the sound off. */
  unlock(): Promise<void> {
    return this.context.state === 'suspended' ? this.context.resume() : Promise.resolve();
  }

  /** Queues a piece. Resolves when it has finished, or at once if it was stopped. */
  async play(bytes: ArrayBuffer): Promise<void> {
    const stops = this.stops;
    const buffer = await this.context.decodeAudioData(bytes);
    if (stops !== this.stops) return;
    const piece = this.schedule(buffer);
    return new Promise((resolve) => {
      piece.source.onended = () => {
        this.forget(piece);
        resolve();
      };
      piece.source.start(piece.startAt);
    });
  }

  /** True while a piece is playing or waiting. */
  get busy(): boolean {
    return this.pieces.length > 0;
  }

  /** How much of the current piece has been heard, 0 to 1. */
  playedFraction(): number {
    const piece = this.pieces[0];
    if (piece === undefined || piece.duration === 0) return 0;
    return Math.min(1, Math.max(0, (this.context.currentTime - piece.startAt) / piece.duration));
  }

  /** Silence now. Everything queued is dropped. */
  stop(): void {
    this.stops += 1;
    const now = this.context.currentTime;
    for (const piece of [...this.pieces]) {
      piece.gain.gain.cancelScheduledValues(now);
      piece.gain.gain.setValueAtTime(piece.level, now);
      piece.gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
      piece.source.stop(now + FADE_SECONDS);
      piece.source.onended?.();
    }
    this.pieces.length = 0;
    this.endsAt = 0;
  }

  /** The call ended: silence, and the audio context goes back to the browser. */
  close(): void {
    this.stop();
    if (this.closed) return;
    this.closed = true;
    void this.context.close();
  }

  private schedule(buffer: PlayerBuffer): Piece {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.context.destination);
    const level = pieceGain(buffer.getChannelData(0), buffer.sampleRate);
    const after = this.endsAt === 0 ? 0 : this.endsAt + SENTENCE_PAUSE_SECONDS;
    const startAt = Math.max(this.context.currentTime, after);
    this.endsAt = startAt + buffer.duration;
    shapeEdges(gain, level, startAt, buffer.duration);
    const piece = { source, gain, level, startAt, duration: buffer.duration };
    this.pieces.push(piece);
    return piece;
  }

  private forget(piece: Piece): void {
    const index = this.pieces.indexOf(piece);
    if (index >= 0) this.pieces.splice(index, 1);
  }
}

function shapeEdges(gain: PlayerGain, level: number, startAt: number, duration: number): void {
  const fade = Math.min(FADE_SECONDS, duration / 2);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(level, startAt + fade);
  gain.gain.setValueAtTime(level, startAt + duration - fade);
  gain.gain.linearRampToValueAtTime(0, startAt + duration);
}
