import { describe, expect, it } from 'vitest';
import { NEAR_BOTTOM_PX, appendDictation, isNearBottom } from './thread-scroll';

describe('isNearBottom', () => {
  it('follows the stream at the end of the thread', () => {
    expect(isNearBottom({ scrollTop: 900, scrollHeight: 1500, clientHeight: 600 })).toBe(true);
    expect(isNearBottom({ scrollTop: 900 - NEAR_BOTTOM_PX, scrollHeight: 1500, clientHeight: 600 })).toBe(true);
  });

  it('leaves a reader of older messages alone', () => {
    expect(isNearBottom({ scrollTop: 100, scrollHeight: 1500, clientHeight: 600 })).toBe(false);
  });
});

describe('appendDictation', () => {
  it('fills an empty draft', () => {
    expect(appendDictation('', ' python jobs ')).toBe('python jobs');
  });

  it('keeps one space between phrases', () => {
    expect(appendDictation('remote', 'only')).toBe('remote only');
    expect(appendDictation('remote ', 'only')).toBe('remote only');
  });

  it('ignores silence', () => {
    expect(appendDictation('remote', '   ')).toBe('remote');
  });
});
