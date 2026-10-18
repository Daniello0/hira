import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { parseResume, type ParseResumeDeps } from './parse-resume.service';
import { formatChatSummary } from '../summarize-chat/summarize-chat.schema';

const logger = pino({ level: 'silent' });
const usage = { promptTokens: 1, completionTokens: 1, totalTokens: 2 };

describe('parseResume cache', () => {
  it('does not call the model again for the same resume text', async () => {
    const provider = {
      calls: 0,
      async completeStructured() {
        this.calls += 1;
        return { content: JSON.stringify({ skills: [{ surface: 'Python', level: 'CONFIDENT', years: 2 }], experience: [{ text: 'BSU' }] }), tokenUsage: usage };
      },
    };
    const cache = memoryCache();
    const deps: ParseResumeDeps = { provider, cache, sleep: async () => undefined, model: 'm', logger, now: () => 0 };
    const first = await parseResume(deps, { resumeText: 'python at BSU' });
    const second = await parseResume(deps, { resumeText: 'python at BSU' });
    expect(first.skills[0]?.surface).toBe('Python');
    expect(second.experience[0]?.text).toBe('BSU');
    expect(provider.calls).toBe(1);
  });
});

describe('formatChatSummary', () => {
  it('keeps the four fixed labels', () => {
    expect(formatChatSummary({ goal: 'python', requirements: 'remote', rejected: 'java', vacancies: 'none' })).toBe(
      ['Цель поиска: python', 'Уточнённые требования: remote', 'Отвергнутые варианты и почему: java', 'Обсуждённые вакансии: none'].join('\n'),
    );
  });
});

function memoryCache() {
  const store = new Map<string, string>();
  return {
    async get(key: string) { return store.get(key) ?? null; },
    async set(key: string, value: string) { store.set(key, value); },
  };
}
