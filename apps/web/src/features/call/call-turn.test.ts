import { VoiceLanguage } from '@hira/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { callTurnRequest } from './call-turn';

describe('callTurnRequest', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('hides foreign remote when the chat switch is off', () => {
    const stored = new Map<string, string>([['hira.includeForeignRemote', 'false']]);
    (globalThis as { window?: Window }).window = {
      localStorage: { getItem: (key: string) => stored.get(key) ?? null },
    } as Window;
    expect(callTurnRequest('python jobs', null)).toEqual({ content: 'python jobs', includeForeignRemote: false });
    expect(callTurnRequest('go on', null, 'Первая вакансия')).toEqual({ content: 'go on', includeForeignRemote: false, interruptedAt: 'Первая вакансия' });
    expect(callTurnRequest('go on', null, '')).toEqual({ content: 'go on', includeForeignRemote: false, interruptedAt: '' });
    expect(callTurnRequest('python jobs', VoiceLanguage.German)).toEqual({ content: 'python jobs', includeForeignRemote: false, language: 'de' });
  });
});
