import { describe, expect, it } from 'vitest';
import { stripHtml } from './strip-html';

describe('stripHtml', () => {
  it('decodes the entities a source puts in visible text', () => {
    expect(stripHtml('ОАО &quot;Завод&quot; &amp; Co')).toBe('ОАО "Завод" & Co');
    expect(stripHtml('a&nbsp;b')).toBe('a b');
  });
});
