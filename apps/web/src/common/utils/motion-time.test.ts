import { describe, expect, it } from 'vitest';
import { parseDurationMs } from './motion-time';

describe('parseDurationMs', () => {
  it('reads both CSS units', () => {
    expect(parseDurationMs('150ms')).toBe(150);
    expect(parseDurationMs(' .2s ')).toBe(200);
  });

  it('falls back when the variable is missing', () => {
    expect(parseDurationMs('')).toBe(200);
  });
});
