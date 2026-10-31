import { describe, expect, it } from 'vitest';
import { pieceGain } from './loudness';

const RATE = 1000;

function tone(amplitude: number, seconds = 1): number[] {
  return Array.from({ length: RATE * seconds }, (_, index) => amplitude * Math.sin(index * 0.3));
}

function rms(samples: readonly number[]): number {
  return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
}

describe('pieceGain', () => {
  it('brings a loud piece and a quiet piece to one level', () => {
    const loud = tone(0.9);
    const quiet = tone(0.2);
    const louder = rms(loud) * pieceGain(loud, RATE);
    const softer = rms(quiet) * pieceGain(quiet, RATE);
    expect(louder).toBeCloseTo(softer, 3);
  });

  it('turns a full-scale piece down', () => {
    expect(pieceGain(tone(1), RATE)).toBeLessThan(0.2);
  });

  it('does not count pauses as quiet speech', () => {
    const speech = tone(0.5);
    const withPause = [...speech, ...new Array<number>(RATE * 3).fill(0)];
    expect(pieceGain(withPause, RATE)).toBeCloseTo(pieceGain(speech, RATE), 3);
  });

  it('never pushes a piece past the peak limit', () => {
    const spiky = [...new Array<number>(RATE).fill(0.01), 0.95, ...new Array<number>(RATE).fill(0.01)];
    expect(0.95 * pieceGain(spiky, RATE)).toBeLessThanOrEqual(0.9);
  });

  it('leaves silence alone', () => {
    expect(pieceGain(new Array<number>(RATE).fill(0), RATE)).toBe(1);
  });
});
