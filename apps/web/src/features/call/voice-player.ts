/** The part of `AudioContext` the player uses. */
export interface PlayerContext {
  currentTime: number;
  destination: unknown;
  state: string;
  resume(): Promise<void>;
  decodeAudioData(bytes: ArrayBuffer): Promise<PlayerBuffer>;
  createBufferSource(): PlayerSource;
}

export interface PlayerBuffer {
  duration: number;
}

export interface PlayerSource {
  buffer: unknown;
  onended: (() => void) | null;
  connect(destination: unknown): void;
  start(when: number): void;
  stop(): void;
}

/**
 * Plays Hira's voice through the page, one piece after another, so the browser's echo canceller
 * knows the sound and a phrase can be cut at once.
 */
export class VoicePlayer {
  private readonly sources = new Set<PlayerSource>();
  private endsAt = 0;

  constructor(private readonly context: PlayerContext) {}

  /** Must run inside the click that starts the call, or Safari keeps the sound off. */
  unlock(): Promise<void> {
    return this.context.state === 'suspended' ? this.context.resume() : Promise.resolve();
  }

  /** Queues a piece. Resolves when it has finished, or at once if it was stopped. */
  async play(bytes: ArrayBuffer): Promise<void> {
    const buffer = await this.context.decodeAudioData(bytes);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    const startAt = Math.max(this.context.currentTime, this.endsAt);
    this.endsAt = startAt + buffer.duration;
    this.sources.add(source);
    return new Promise((resolve) => {
      source.onended = () => {
        this.sources.delete(source);
        resolve();
      };
      source.start(startAt);
    });
  }

  /** True while a piece is playing or waiting. */
  get busy(): boolean {
    return this.sources.size > 0;
  }

  /** Silence now. Everything queued is dropped. */
  stop(): void {
    for (const source of [...this.sources]) {
      source.stop();
      source.onended?.();
    }
    this.sources.clear();
    this.endsAt = 0;
  }
}
