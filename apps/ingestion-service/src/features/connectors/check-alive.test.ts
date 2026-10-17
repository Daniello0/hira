import { describe, expect, it } from 'vitest';
import { aliveVerdict } from './check-alive';

describe('aliveVerdict', () => {
  it('treats an explicit archive as closed and a missing page as gone', () => {
    expect(aliveVerdict(200, '<h1>Backend</h1>')).toBe('open');
    expect(aliveVerdict(200, '<div data-qa="vacancy-title-archived-text">В архиве</div>')).toBe(
      'archived',
    );
    expect(aliveVerdict(410, '{"archived":true}')).toBe('archived');
    expect(aliveVerdict(404, 'missing')).toBe('gone');
    expect(aliveVerdict(410, 'gone')).toBe('gone');
    expect(() => aliveVerdict(500, 'down')).toThrow(/500/);
  });
});
