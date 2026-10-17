import { describe, expect, it } from 'vitest';
import { quoteFromDescription } from './quote-span';

describe('quoteFromDescription', () => {
  const description = 'опыт контейнеризации приложений (Docker)';

  it('keeps a quote that occurs in the description', () => {
    expect(quoteFromDescription(description, 'Docker')).toBe('Docker');
  });

  it('drops a blank quote and a quote the description does not contain', () => {
    expect(quoteFromDescription(description, 'Kubernetes')).toBeNull();
    expect(quoteFromDescription(description, '  ')).toBeNull();
    expect(quoteFromDescription(description, null)).toBeNull();
  });
});
