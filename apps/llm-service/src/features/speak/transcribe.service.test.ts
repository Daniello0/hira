import { describe, expect, it, vi } from 'vitest';
import { TRANSCRIBE_MODEL } from '../llm/llm.constants';
import { LlmRouteError } from '../llm/llm.errors';
import { createTranscriber, languageCode, parseTranscribeRequest } from './transcribe.service';

const CONFIG = { apiKey: 'sk-test', baseUrl: 'https://router.test/api/v1/' };

describe('transcriber', () => {
  it('sends the phrase to the cloud recognizer and returns the text with a language code', async () => {
    const request = vi.fn(async () => Response.json({ text: ' Найди вакансии ', language: 'Russian' }));
    const heard = await createTranscriber(CONFIG, request as typeof fetch)({ audio: Buffer.from('wav'), language: null });
    expect(heard).toEqual({ text: 'Найди вакансии', language: 'ru' });
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://router.test/api/v1/audio/transcriptions');
    const form = init.body as FormData;
    expect(form.get('model')).toBe(TRANSCRIBE_MODEL);
    expect(form.get('language')).toBeNull();
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer sk-test');
  });

  it('pins the language the user chose', async () => {
    const request = vi.fn(async () => Response.json({ text: 'Hallo', language: 'de' }));
    await createTranscriber(CONFIG, request as typeof fetch)({ audio: Buffer.from('wav'), language: 'de' });
    expect(((request.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData).get('language')).toBe('de');
  });

  it('turns a refusal and a dead network into the upstream error', async () => {
    const refused = vi.fn(async () => new Response('no credits', { status: 402 }));
    await expect(createTranscriber(CONFIG, refused as typeof fetch)({ audio: Buffer.from('wav'), language: null })).rejects.toBeInstanceOf(LlmRouteError);
    const down = vi.fn(async () => { throw new TypeError('fetch failed'); });
    await expect(createTranscriber(CONFIG, down as typeof fetch)({ audio: Buffer.from('wav'), language: null })).rejects.toBeInstanceOf(LlmRouteError);
  });

  it('names languages by code', () => {
    expect(languageCode('ru')).toBe('ru');
    expect(languageCode('Ukrainian')).toBe('uk');
    expect(languageCode('latin')).toBe('latin');
    expect(languageCode('')).toBeNull();
    expect(languageCode(undefined)).toBeNull();
  });

  it('rejects an empty phrase', () => {
    expect(() => parseTranscribeRequest(Buffer.alloc(0), null)).toThrow();
    expect(() => parseTranscribeRequest({}, null)).toThrow();
    expect(parseTranscribeRequest(Buffer.from('wav'), 'ru')).toEqual({ audio: Buffer.from('wav'), language: 'ru' });
  });
});
