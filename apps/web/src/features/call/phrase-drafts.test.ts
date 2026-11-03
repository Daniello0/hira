import { describe, expect, it, vi } from 'vitest';
import { PhraseDrafts } from './phrase-drafts';

const OPTIONS = { padFrames: 2, draftEveryFrames: 3, pauseFrames: 2, speechAbove: 0.3, quietBelow: 0.25 };
const SPEECH = 0.9;
const QUIET = 0.05;

function frame(value: number): Float32Array {
  return new Float32Array([value]);
}

function feed(drafts: PhraseDrafts, probabilities: readonly number[], from = 0): void {
  probabilities.forEach((probability, index) => drafts.frame(probability, frame(from + index)));
}

describe('phrase drafts', () => {
  it('keeps the pad before the speech and drafts the phrase while it goes on', () => {
    const onDraft = vi.fn();
    const drafts = new PhraseDrafts(OPTIONS, onDraft);
    feed(drafts, [QUIET, QUIET, QUIET, SPEECH]);
    drafts.realStart();
    feed(drafts, [SPEECH, SPEECH, SPEECH], 4);
    expect(onDraft).toHaveBeenCalledTimes(1);
    const [audio, paused] = onDraft.mock.calls[0] as [Float32Array, boolean];
    expect(Array.from(audio)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(paused).toBe(false);
  });

  it('reads the whole phrase once at a pause, and the end needs no second read', () => {
    const onDraft = vi.fn();
    const drafts = new PhraseDrafts(OPTIONS, onDraft);
    feed(drafts, [SPEECH]);
    drafts.realStart();
    feed(drafts, [QUIET, QUIET, QUIET, QUIET], 1);
    expect(onDraft).toHaveBeenCalledTimes(1);
    expect(onDraft.mock.calls[0]?.[1]).toBe(true);
    expect(drafts.end()).toBe(true);
  });

  it('forgets the pause read when the speech goes on', () => {
    const onDraft = vi.fn();
    const drafts = new PhraseDrafts(OPTIONS, onDraft);
    feed(drafts, [SPEECH]);
    drafts.realStart();
    feed(drafts, [QUIET, QUIET, SPEECH], 1);
    expect(drafts.end()).toBe(false);
  });

  it('drafts nothing before the VAD is sure, and starts clean after a misfire', () => {
    const onDraft = vi.fn();
    const drafts = new PhraseDrafts(OPTIONS, onDraft);
    feed(drafts, [SPEECH, QUIET, QUIET, QUIET, SPEECH, SPEECH, SPEECH]);
    expect(onDraft).not.toHaveBeenCalled();
    drafts.reset();
    expect(drafts.end()).toBe(false);
  });
});
