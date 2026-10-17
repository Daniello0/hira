import { describe, expect, it } from 'vitest';
import { contentHash, conditionsText, sourceHash } from './content-hash';

describe('sourceHash', () => {
  const source = { title: 'Backend', description: 'пишем api', conditions: 'REMOTE|' };

  it('matches the content hash of the same text with empty skills', () => {
    expect(sourceHash(source)).toBe(contentHash({ ...source, skillsText: '' }));
    expect(conditionsText(null, null)).toBe('|');
    expect(conditionsText('REMOTE', '5/2')).toBe('REMOTE|5/2');
  });

  it('ignores skill text and changes when the description changes', () => {
    const withSkills = contentHash({ ...source, skillsText: 'Python' });
    expect(sourceHash(source)).not.toBe(withSkills);
    expect(sourceHash({ ...source, description: 'другой текст' })).not.toBe(sourceHash(source));
  });
});
