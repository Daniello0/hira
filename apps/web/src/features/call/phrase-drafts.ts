/** How the microphone frames are read ahead of the end of a phrase. Counts are in frames. */
export interface PhraseDraftOptions {
  /** Frames kept from before the speech, as the VAD keeps them. */
  padFrames: number;
  /** A draft while the phrase goes on, at most this often. */
  draftEveryFrames: number;
  /** Quiet frames after which the phrase is read in full, in case the pause ends it. */
  pauseFrames: number;
  /** The VAD's own thresholds, so a pause here is a pause there. */
  speechAbove: number;
  quietBelow: number;
}

/**
 * Follows the microphone frame by frame, the way the VAD does, and says when to read the phrase ahead:
 * now and then while it is said, for the words on screen, and once at a pause that may end it. When the
 * pause does end it, that read already heard the whole phrase and the end needs no second one.
 */
export class PhraseDrafts {
  private frames: Float32Array[] = [];
  private speaking = false;
  private real = false;
  private quietFrames = 0;
  private sinceDraft = 0;
  private pauseRead = false;

  constructor(
    private readonly options: PhraseDraftOptions,
    private readonly onDraft: (audio: Float32Array, paused: boolean) => void,
  ) {}

  /** One frame with its speech probability. Runs before the VAD's own events for that frame. */
  frame(probability: number, frame: Float32Array): void {
    const speech = probability >= this.options.speechAbove;
    this.frames.push(frame);
    if (!this.speaking && !speech) {
      if (this.frames.length > this.options.padFrames) this.frames.shift();
      return;
    }
    this.speaking = true;
    if (speech) {
      this.quietFrames = 0;
      this.pauseRead = false;
    } else if (probability < this.options.quietBelow) this.quietFrames += 1;
    if (!this.real) return;
    this.sinceDraft += 1;
    if (!this.pauseRead && this.quietFrames >= this.options.pauseFrames) {
      this.pauseRead = true;
      this.sinceDraft = 0;
      this.onDraft(joinFrames(this.frames), true);
    } else if (speech && this.sinceDraft >= this.options.draftEveryFrames) {
      this.sinceDraft = 0;
      this.onDraft(joinFrames(this.frames), false);
    }
  }

  /** The VAD is sure this is speech. Drafts start only now, so a cough costs nothing. */
  realStart(): void {
    this.real = true;
  }

  /** The phrase ended. True when the read at its last pause heard all of it. */
  end(): boolean {
    const covered = this.pauseRead;
    this.reset();
    return covered;
  }

  /** The VAD dropped the sound as not speech. */
  reset(): void {
    this.frames = [];
    this.speaking = false;
    this.real = false;
    this.quietFrames = 0;
    this.sinceDraft = 0;
    this.pauseRead = false;
  }
}

function joinFrames(frames: readonly Float32Array[]): Float32Array {
  const audio = new Float32Array(frames.reduce((length, frame) => length + frame.length, 0));
  let offset = 0;
  for (const frame of frames) {
    audio.set(frame, offset);
    offset += frame.length;
  }
  return audio;
}
