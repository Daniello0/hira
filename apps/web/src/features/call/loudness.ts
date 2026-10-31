/** Speech level every piece of Hira's voice is brought to. The device's own volume does the rest. */
const TARGET_DB = -23;
/** A piece is never pushed past this, so a loud consonant does not clip. */
const PEAK_LIMIT_DB = -1;
const WINDOW_SECONDS = 0.05;
/** A window quieter than this is a pause between words and says nothing about the level. */
const PAUSE_DB = -50;

/**
 * Gain that brings a piece of voice to one level. The synthesizer stretches each piece to full scale
 * on its own, so without this every sentence comes out at a different loudness.
 */
export function pieceGain(samples: ArrayLike<number>, sampleRate: number): number {
  const level = speechLevel(samples, Math.max(1, Math.round(sampleRate * WINDOW_SECONDS)));
  if (level.rms === 0) return 1;
  return Math.min(fromDb(TARGET_DB) / level.rms, fromDb(PEAK_LIMIT_DB) / level.peak);
}

function speechLevel(samples: ArrayLike<number>, windowSize: number): { rms: number; peak: number } {
  let energy = 0;
  let counted = 0;
  let peak = 0;
  for (let start = 0; start < samples.length; start += windowSize) {
    const end = Math.min(start + windowSize, samples.length);
    let sum = 0;
    for (let index = start; index < end; index += 1) {
      const sample = samples[index] ?? 0;
      sum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    if (Math.sqrt(sum / (end - start)) < fromDb(PAUSE_DB)) continue;
    energy += sum;
    counted += end - start;
  }
  return { rms: counted === 0 ? 0 : Math.sqrt(energy / counted), peak };
}

function fromDb(db: number): number {
  return 10 ** (db / 20);
}
