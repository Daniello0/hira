import { VoiceLanguage } from '@hira/contracts';
import { describe, expect, it, vi } from 'vitest';
import { SpeechUnavailableError, closedWav, createCloudSpeaker, createSpeechGateway } from './speech-gateway';
import { CLOUD_VOICES, TRANSCRIBE_MODEL, VOICES } from './speech.constants';

const BASE = 'http://speech:8000';

describe('speech gateway', () => {
  it('returns the text and the language the recognizer heard', async () => {
    const request = vi.fn(async () => Response.json({ text: ' Привет ', language: 'ru' }));
    const gateway = createSpeechGateway(BASE, request as typeof fetch);
    expect(await gateway.transcribe(Buffer.from('wav'), null)).toEqual({ text: 'Привет', language: 'ru' });
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/v1/audio/transcriptions`);
    const form = init.body as FormData;
    expect(form.get('model')).toBe(TRANSCRIBE_MODEL);
    expect(form.get('language')).toBeNull();
  });

  it('pins the language when the user chose one', async () => {
    const request = vi.fn(async () => Response.json({ text: 'x', language: 'de' }));
    await createSpeechGateway(BASE, request as typeof fetch).transcribe(Buffer.from('wav'), VoiceLanguage.German);
    const init = (request.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.body as FormData).get('language')).toBe('de');
  });

  it('uses the voice of the language, for all five', async () => {
    for (const language of Object.values(VoiceLanguage)) {
      const request = vi.fn(async () => new Response('audio'));
      await createSpeechGateway(BASE, request as typeof fetch).synthesize('Текст', language);
      const init = (request.mock.calls[0] as unknown as [string, RequestInit])[1];
      expect(JSON.parse(String(init.body))).toMatchObject({ ...VOICES[language], input: 'Текст', response_format: 'wav' });
    }
  });

  it('speaks with the cloud voice of the language, for all five', async () => {
    for (const language of Object.values(VoiceLanguage)) {
      const speak = vi.fn(async () => Buffer.from('natural'));
      const local = vi.fn();
      const audio = await createSpeechGateway(BASE, local as unknown as typeof fetch, { speak, onFailure: vi.fn() }).synthesize('Текст', language);
      expect(speak).toHaveBeenCalledWith('Текст', CLOUD_VOICES[language]);
      expect(audio).toEqual({ bytes: Buffer.from('natural'), contentType: 'audio/mpeg' });
      expect(local).not.toHaveBeenCalled();
    }
  });

  it('falls back to the local voice when the cloud one fails, and says so', async () => {
    const failure = new Error('no credits');
    const onFailure = vi.fn();
    const local = vi.fn(async () => new Response('local'));
    const audio = await createSpeechGateway(BASE, local as unknown as typeof fetch, { speak: async () => { throw failure; }, onFailure }).synthesize('x', VoiceLanguage.German);
    expect(audio.bytes.toString()).toBe('local');
    expect(audio.contentType).toBe('audio/wav');
    expect(onFailure).toHaveBeenCalledWith(failure);
  });

  it('asks llm-service for the cloud voice, and fails on a bad answer', async () => {
    const request = vi.fn(async () => new Response('sound'));
    const speak = createCloudSpeaker({ baseUrl: 'http://llm:4002/', token: 'secret' }, request as typeof fetch);
    expect((await speak('Текст', 'voice-id')).toString()).toBe('sound');
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://llm:4002/internal/v1/speak');
    expect(new Headers(init.headers).get('x-internal-token')).toBe('secret');
    expect(JSON.parse(String(init.body))).toEqual({ text: 'Текст', voice: 'voice-id' });
    const refused = vi.fn(async () => new Response('no', { status: 502 }));
    await expect(createCloudSpeaker({ baseUrl: 'http://llm', token: 't' }, refused as typeof fetch)('x', 'v')).rejects.toThrow('502');
  });

  it('fetches a missing model once and tries again', async () => {
    const replies = [new Response('missing', { status: 404 }), new Response('ok'), new Response('audio')];
    const request = vi.fn(async () => replies.shift() as Response);
    const audio = await createSpeechGateway(BASE, request as typeof fetch).synthesize('x', VoiceLanguage.French);
    expect(audio.bytes.toString()).toBe('audio');
    expect(audio.contentType).toBe('audio/wav');
    expect((request.mock.calls[1] as unknown as [string])[0]).toBe(`${BASE}/v1/models/${VOICES[VoiceLanguage.French].model}`);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('says the service is unavailable when it is down or fails', async () => {
    const down = vi.fn(async () => { throw new TypeError('fetch failed'); });
    await expect(createSpeechGateway(BASE, down as typeof fetch).synthesize('x', VoiceLanguage.Russian)).rejects.toBeInstanceOf(SpeechUnavailableError);
    const failing = vi.fn(async () => new Response('no', { status: 500 }));
    await expect(createSpeechGateway(BASE, failing as typeof fetch).transcribe(Buffer.from('x'), null)).rejects.toBeInstanceOf(SpeechUnavailableError);
  });
});

describe('closedWav', () => {
  function openWav(dataBytes: number): Buffer {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0, 'latin1');
    header.writeUInt32LE(0xffffffff, 4);
    header.write('WAVEfmt ', 8, 'latin1');
    header.write('data', 36, 'latin1');
    header.writeUInt32LE(0xffffffff, 40);
    return Buffer.concat([header, Buffer.alloc(dataBytes)]);
  }

  it('writes the real sizes into a streamed header', () => {
    const closed = closedWav(openWav(100));
    expect(closed.readUInt32LE(4)).toBe(136);
    expect(closed.readUInt32LE(40)).toBe(100);
  });

  it('finds the data chunk after an extra LIST chunk', () => {
    const list = Buffer.from('LIST\u0004\0\0\0abcd', 'latin1');
    const wav = openWav(10);
    const shifted = Buffer.concat([wav.subarray(0, 36), list, wav.subarray(36)]);
    expect(closedWav(shifted).readUInt32LE(36 + list.length + 4)).toBe(10);
  });

  it('leaves anything else alone', () => {
    expect(closedWav(Buffer.from('not audio')).toString()).toBe('not audio');
  });
});
