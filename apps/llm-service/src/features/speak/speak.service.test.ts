import { describe, expect, it, vi } from 'vitest';
import { SPEECH_MODEL } from '../llm/llm.constants';
import { LlmRouteError } from '../llm/llm.errors';
import { createSpeaker, parseSpeakRequest } from './speak.service';

const CONFIG = { apiKey: 'sk-test', baseUrl: 'https://router.test/api/v1/' };
const SPOKEN = { text: 'Привет', voice: 'ru-RU-Harper:MAI-Voice-2.1-Flash' };

describe('speaker', () => {
  it('asks for the text in the given voice, as MP3', async () => {
    const request = vi.fn(async () => new Response('sound'));
    const audio = await createSpeaker(CONFIG, request as typeof fetch)(SPOKEN);
    expect(audio.toString()).toBe('sound');
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://router.test/api/v1/audio/speech');
    expect(JSON.parse(String(init.body))).toEqual({ model: SPEECH_MODEL, voice: SPOKEN.voice, input: 'Привет', response_format: 'mp3' });
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer sk-test');
  });

  it('turns a refusal and a dead network into the upstream error', async () => {
    const refused = vi.fn(async () => new Response('no credits', { status: 402 }));
    await expect(createSpeaker(CONFIG, refused as typeof fetch)(SPOKEN)).rejects.toBeInstanceOf(LlmRouteError);
    const down = vi.fn(async () => { throw new TypeError('fetch failed'); });
    await expect(createSpeaker(CONFIG, down as typeof fetch)(SPOKEN)).rejects.toBeInstanceOf(LlmRouteError);
  });

  it('rejects a body without text or voice', () => {
    expect(() => parseSpeakRequest({ text: '', voice: 'x' })).toThrow();
    expect(() => parseSpeakRequest({ text: 'x' })).toThrow();
  });
});
