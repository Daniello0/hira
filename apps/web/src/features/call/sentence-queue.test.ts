import { describe, expect, it } from 'vitest';
import { speakableText, takeSentences } from './sentence-queue';

describe('takeSentences', () => {
  it('cuts off finished sentences and keeps the unfinished rest', () => {
    const { sentences, rest } = takeSentences('Нашла две вакансии в Минске для вас. Первая из них');
    expect(sentences).toEqual(['Нашла две вакансии в Минске для вас.']);
    expect(rest.trim()).toBe('Первая из них');
  });

  it('waits for the space after the mark, since a number or a word may go on', () => {
    expect(takeSentences('Зарплата составляет от 2.5').sentences).toEqual([]);
    expect(takeSentences('Вакансия на сайте rabota.by').sentences).toEqual([]);
  });

  it('does not speak a short piece on its own', () => {
    const { sentences } = takeSentences('Работа в г. Минск, полная занятость и хорошие условия. Дальше');
    expect(sentences).toEqual(['Работа в г. Минск, полная занятость и хорошие условия.']);
  });

  it('handles several sentences and other marks', () => {
    const { sentences, rest } = takeSentences('Is this a remote job for you? Yes, it is fully remote work! ');
    expect(sentences).toEqual(['Is this a remote job for you?', 'Yes, it is fully remote work!']);
    expect(rest.trim()).toBe('');
  });
});

describe('speakableText', () => {
  it('drops Markdown marks and links', () => {
    expect(speakableText('**Python** разработчик, [ссылка](https://x.by) и _ещё_')).toBe('Python разработчик, ссылка и ещё');
    expect(speakableText('- первая\n- вторая')).toBe('первая вторая');
    expect(speakableText('смотри https://rabota.by/vacancy/1 тут')).toBe('смотри тут');
  });

  it('leaves nothing when there is nothing to say', () => {
    expect(speakableText('*** | ---'.replace('---', ''))).toBe('');
  });
});
