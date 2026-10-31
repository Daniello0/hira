import { VoiceLanguage } from '@hira/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { ParsedSse } from '../chat/sse-parser';
import { CallPhase } from './call-phase';
import type { LanguageChoice } from './call-language';
import { emptyCall, type CallViewState } from './reduce-call';
import { cutAtWord, VoiceSession, type MicHandlers, type VoiceDeps } from './voice-session';

const OPEN = { opened: true, status: 200, error: null, interrupted: false };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

function rig(overrides: Partial<VoiceDeps> = {}, choice: LanguageChoice = 'auto') {
  let state: CallViewState = emptyCall();
  let mic: MicHandlers | null = null;
  const stopMic = vi.fn();
  const pieces: Array<{ finish: () => void }> = [];
  const player = {
    play: vi.fn(() => new Promise<void>((resolve) => pieces.push({ finish: resolve }))),
    stop: vi.fn(() => {
      for (const piece of pieces.splice(0)) piece.finish();
    }),
    playedFraction: vi.fn(() => 0.5),
  };
  const deps: VoiceDeps = {
    startMic: vi.fn(async (handlers) => {
      mic = handlers;
      return { stop: stopMic };
    }),
    player,
    transcribe: vi.fn(async () => ({ text: 'Найди работу в Минске сейчас', language: 'ru' })),
    synthesize: vi.fn(async () => new ArrayBuffer(4)),
    streamTurn: vi.fn(async () => OPEN),
    commit: (update) => {
      state = update(state);
      return state;
    },
    choice: () => choice,
    browserLanguage: () => 'en-US',
    onMicBlocked: vi.fn(),
    onVoiceTrouble: vi.fn(),
    ...overrides,
  };
  return {
    deps,
    session: new VoiceSession(deps),
    player,
    pieces,
    stopMic,
    state: () => state,
    mic: () => mic as unknown as MicHandlers,
  };
}

const token = (delta: string): ParsedSse => ({ event: 'token', data: { delta } });
const SENTENCE = 'Нашла для вас две хорошие вакансии в Минске. ';
const PHRASE = new Blob(['wav']);

describe('voice session', () => {
  it('opens the microphone and listens', async () => {
    const { session, state, deps } = rig();
    await session.open();
    expect(deps.startMic).toHaveBeenCalled();
    expect(state().phase).toBe(CallPhase.Listening);
  });

  it('asks to type when the microphone is blocked', async () => {
    const onMicBlocked = vi.fn();
    const { session, state } = rig({ startMic: async () => { throw new Error('denied'); }, onMicBlocked });
    await session.open();
    expect(onMicBlocked).toHaveBeenCalled();
    expect(state().phase).toBe(CallPhase.Listening);
  });

  it('hears a phrase, asks, and speaks the reply in the language heard, before the answer has finished', async () => {
    const gate = deferred<typeof OPEN>();
    const streamTurn = vi.fn(async (_text: string, _language: unknown, _i: unknown, _signal: AbortSignal, onEvent: (event: ParsedSse) => void) => {
      onEvent(token(SENTENCE));
      return gate.promise;
    });
    const { session, mic, deps, state, pieces } = rig({ streamTurn });
    await session.open();
    void mic().onPhrase(PHRASE);
    await flush();
    expect(streamTurn.mock.calls[0]?.[0]).toBe('Найди работу в Минске сейчас');
    expect(state().captions[0]?.content).toBe('Найди работу в Минске сейчас');
    expect(deps.synthesize).toHaveBeenCalledWith(SENTENCE.trim(), VoiceLanguage.Russian, expect.anything());
    expect(state().phase).toBe(CallPhase.Speaking);
    expect(pieces).toHaveLength(1);
    gate.resolve(OPEN);
  });

  it('returns to listening once the last piece has played', async () => {
    const streamTurn = vi.fn(async (_t: string, _l: unknown, _i: unknown, _s: AbortSignal, onEvent: (event: ParsedSse) => void) => {
      onEvent(token(SENTENCE));
      onEvent({ event: 'done', data: {} });
      return OPEN;
    });
    const { session, mic, state, pieces } = rig({ streamTurn });
    await session.open();
    void mic().onPhrase(PHRASE);
    await flush();
    expect(state().phase).toBe(CallPhase.Speaking);
    pieces[0]?.finish();
    await flush();
    expect(state().phase).toBe(CallPhase.Listening);
  });

  it('speaks what is left when the answer ends without a full stop', async () => {
    const streamTurn = vi.fn(async (_t: string, _l: unknown, _i: unknown, _s: AbortSignal, onEvent: (event: ParsedSse) => void) => {
      onEvent(token('**Коротко**'));
      return OPEN;
    });
    const { session, mic, deps } = rig({ streamTurn });
    await session.open();
    void mic().onPhrase(PHRASE);
    await flush();
    expect(deps.synthesize).toHaveBeenCalledWith('Коротко', VoiceLanguage.Russian, expect.anything());
  });

  it('stops talking and cancels the answer the moment the user speaks', async () => {
    let signal: AbortSignal | null = null;
    const gate = deferred<typeof OPEN>();
    const streamTurn = vi.fn(async (_t: string, _l: unknown, _i: unknown, given: AbortSignal, onEvent: (event: ParsedSse) => void) => {
      signal = given;
      onEvent(token(SENTENCE));
      return gate.promise;
    });
    const { session, mic, player, state, deps } = rig({ streamTurn });
    await session.open();
    void mic().onPhrase(PHRASE);
    await flush();
    mic().onSpeechStart();
    expect(player.stop).toHaveBeenCalled();
    expect(signal!.aborted).toBe(true);
    expect(state().phase).toBe(CallPhase.Listening);
    gate.resolve(OPEN);
    await flush();
    expect(deps.synthesize).toHaveBeenCalledTimes(1);
    expect(state().phase).toBe(CallPhase.Listening);
  });

  it('interrupts while Hira is still thinking', async () => {
    const gate = deferred<typeof OPEN>();
    const { session, mic, state } = rig({ streamTurn: vi.fn(() => gate.promise) });
    await session.open();
    void mic().onPhrase(PHRASE);
    await flush();
    expect(state().phase).toBe(CallPhase.Thinking);
    mic().onSpeechStart();
    expect(state().phase).toBe(CallPhase.Listening);
    gate.resolve(OPEN);
  });

  it('drops late tokens of an interrupted answer', async () => {
    let emit: (event: ParsedSse) => void = () => undefined;
    const gate = deferred<typeof OPEN>();
    const streamTurn = vi.fn(async (_t: string, _l: unknown, _i: unknown, _s: AbortSignal, onEvent: (event: ParsedSse) => void) => {
      emit = onEvent;
      return gate.promise;
    });
    const { session, mic, state, deps } = rig({ streamTurn });
    await session.open();
    void mic().onPhrase(PHRASE);
    await flush();
    mic().onSpeechStart();
    emit(token(SENTENCE));
    expect(state().captions.at(-1)?.content).not.toContain('Нашла');
    expect(deps.synthesize).not.toHaveBeenCalled();
    gate.resolve(OPEN);
  });

  it('does not treat the start of an ordinary phrase as an interruption', async () => {
    const { session, mic, player } = rig();
    await session.open();
    mic().onSpeechStart();
    expect(player.stop).not.toHaveBeenCalled();
  });

  it('keeps the first half of a phrase when the user goes on while it is being read', async () => {
    const first = deferred<{ text: string; language: string }>();
    const transcribe = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce({ text: 'в Минске', language: 'ru' });
    const { session, mic, deps } = rig({ transcribe });
    await session.open();
    void mic().onPhrase(PHRASE);
    await flush();
    mic().onSpeechStart();
    first.resolve({ text: 'Найди работу', language: 'ru' });
    await flush();
    void mic().onPhrase(PHRASE);
    await flush();
    expect((deps.streamTurn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe('Найди работу в Минске');
  });

  it('goes back to listening on an empty phrase', async () => {
    const { session, mic, state, deps } = rig({ transcribe: vi.fn(async () => ({ text: '', language: null })) });
    await session.open();
    await mic().onPhrase(PHRASE);
    expect(state().phase).toBe(CallPhase.Listening);
    expect(deps.streamTurn).not.toHaveBeenCalled();
  });

  it('says so and offers typing when the recognizer is down', async () => {
    const onVoiceTrouble = vi.fn();
    const { session, mic, state } = rig({ transcribe: vi.fn(async () => { throw new Error('503'); }), onVoiceTrouble });
    await session.open();
    await mic().onPhrase(PHRASE);
    expect(onVoiceTrouble).toHaveBeenCalled();
    expect(state().phase).toBe(CallPhase.Listening);
  });

  it('keeps the words on screen when the voice is down', async () => {
    const onVoiceTrouble = vi.fn();
    const streamTurn = vi.fn(async (_t: string, _l: unknown, _i: unknown, _s: AbortSignal, onEvent: (event: ParsedSse) => void) => {
      onEvent(token(SENTENCE));
      return OPEN;
    });
    const { session, mic, state } = rig({ streamTurn, onVoiceTrouble, synthesize: vi.fn(async () => { throw new Error('503'); }) });
    await session.open();
    await mic().onPhrase(PHRASE);
    await flush();
    expect(onVoiceTrouble).toHaveBeenCalled();
    expect(state().captions.at(-1)?.content).toContain('Нашла');
    expect(state().phase).toBe(CallPhase.Listening);
  });

  it('shows the error of a turn that did not open and goes on listening', async () => {
    const streamTurn = vi.fn(async () => ({ opened: false, status: 503, error: null, interrupted: false }));
    const { session, mic, state } = rig({ streamTurn });
    await session.open();
    await mic().onPhrase(PHRASE);
    await flush();
    expect(state().phase).toBe(CallPhase.Listening);
    expect(state().notice).not.toBeNull();
  });

  it('speaks and replies in the language from the menu', async () => {
    const streamTurn = vi.fn(async (_t: string, _l: unknown, _i: unknown, _s: AbortSignal, onEvent: (event: ParsedSse) => void) => {
      onEvent(token(SENTENCE));
      return OPEN;
    });
    const { session, mic, deps } = rig({ streamTurn }, VoiceLanguage.German);
    await session.open();
    void mic().onPhrase(PHRASE);
    await flush();
    expect(deps.transcribe).toHaveBeenCalledWith(PHRASE, VoiceLanguage.German);
    expect(streamTurn.mock.calls[0]?.[1]).toBe(VoiceLanguage.German);
    expect(deps.synthesize).toHaveBeenCalledWith(expect.anything(), VoiceLanguage.German, expect.anything());
  });

  it('answers a typed phrase the same way', async () => {
    const streamTurn = vi.fn(async (_t: string, _l: unknown, _i: unknown, _s: AbortSignal, onEvent: (event: ParsedSse) => void) => {
      onEvent(token(SENTENCE));
      return OPEN;
    });
    const { session, deps } = rig({ streamTurn });
    await session.open();
    void session.sayTyped('Что у меня в избранном?');
    await flush();
    expect(streamTurn.mock.calls[0]?.[0]).toBe('Что у меня в избранном?');
    expect(deps.synthesize).toHaveBeenCalledWith(expect.anything(), VoiceLanguage.Russian, expect.anything());
  });

  it('falls back to the browser language for the voice when nothing tells it otherwise', async () => {
    const streamTurn = vi.fn(async (_t: string, _l: unknown, _i: unknown, _s: AbortSignal, onEvent: (event: ParsedSse) => void) => {
      onEvent(token('I found two good vacancies for you in Minsk. '));
      return OPEN;
    });
    const { session, deps } = rig({ streamTurn, browserLanguage: () => 'fr-FR' });
    await session.open();
    void session.sayTyped('hello there');
    await flush();
    expect(deps.synthesize).toHaveBeenCalledWith(expect.anything(), VoiceLanguage.French, expect.anything());
  });

  it('tells the next turn how far the reply got when the user cuts it off', async () => {
    const first = 'Нашла для вас две хорошие вакансии в Минске.';
    const second = 'Первая из них это продуктовый аналитик, зарплата выше рынка.';
    const streamTurn = vi.fn(async (_t: string, _l: unknown, _i: unknown, _s: AbortSignal, onEvent: (event: ParsedSse) => void) => {
      if (streamTurn.mock.calls.length > 1) return OPEN;
      onEvent(token(`${first} ${second} `));
      onEvent({ event: 'done', data: {} });
      return OPEN;
    });
    const { session, mic, state, pieces } = rig({ streamTurn });
    await session.open();
    void mic().onPhrase(PHRASE);
    await flush();
    pieces[0]?.finish();
    await flush();
    mic().onSpeechStart();
    const heard = `${first} ${cutAtWord(second, 0.5)}`;
    expect(state().captions.at(-1)?.content).toBe(heard);
    void mic().onPhrase(PHRASE);
    await flush();
    expect(streamTurn.mock.calls[1]?.[2]).toBe(heard);
    expect(streamTurn.mock.calls[0]?.[2]).toBeNull();
  });

  it('says nothing was heard when the reply was cut before its first sound', async () => {
    const voice = deferred<ArrayBuffer>();
    const streamTurn = vi.fn(async (_t: string, _l: unknown, _i: unknown, _s: AbortSignal, onEvent: (event: ParsedSse) => void) => {
      if (streamTurn.mock.calls.length === 1) onEvent(token(SENTENCE));
      return OPEN;
    });
    const { session, mic, state } = rig({ streamTurn, synthesize: vi.fn(() => voice.promise) });
    await session.open();
    void mic().onPhrase(PHRASE);
    await flush();
    mic().onSpeechStart();
    expect(state().captions.at(-1)?.role).toBe('USER');
    void mic().onPhrase(PHRASE);
    await flush();
    expect(streamTurn.mock.calls[1]?.[2]).toBe('');
  });

  it('reports no cut for a reply that was spoken to the end', async () => {
    const streamTurn = vi.fn(async (_t: string, _l: unknown, _i: unknown, _s: AbortSignal, onEvent: (event: ParsedSse) => void) => {
      if (streamTurn.mock.calls.length === 1) onEvent(token(SENTENCE));
      return OPEN;
    });
    const { session, mic, pieces } = rig({ streamTurn });
    await session.open();
    void mic().onPhrase(PHRASE);
    await flush();
    pieces[0]?.finish();
    await flush();
    mic().onSpeechStart();
    void mic().onPhrase(PHRASE);
    await flush();
    expect(streamTurn.mock.calls[1]?.[2]).toBeNull();
  });

  it('gives a voice only to the piece playing and the one after it', async () => {
    const line = ['Первое предложение ответа про вакансии.', 'Второе предложение ответа про вакансии.', 'Третье предложение ответа про вакансии.', 'Четвёртое предложение ответа про вакансии.'];
    const streamTurn = vi.fn(async (_t: string, _l: unknown, _i: unknown, _s: AbortSignal, onEvent: (event: ParsedSse) => void) => {
      onEvent(token(`${line.join(' ')} `));
      return OPEN;
    });
    const { session, mic, deps, pieces } = rig({ streamTurn });
    await session.open();
    void mic().onPhrase(PHRASE);
    await flush();
    expect(deps.synthesize).toHaveBeenCalledTimes(2);
    pieces[0]?.finish();
    await flush();
    expect(deps.synthesize).toHaveBeenCalledTimes(3);
  });

  it('cuts a sentence on a whole word', () => {
    expect(cutAtWord('Первая вакансия в Минске', 0.5)).toBe('Первая');
    expect(cutAtWord('Первая вакансия', 0)).toBe('');
    expect(cutAtWord('Первая вакансия', 1)).toBe('Первая вакансия');
  });

  it('closes everything on end, and later events change nothing', async () => {
    const gate = deferred<typeof OPEN>();
    const { session, mic, stopMic, player, state } = rig({ streamTurn: vi.fn(() => gate.promise) });
    await session.open();
    void mic().onPhrase(PHRASE);
    await flush();
    session.close();
    expect(stopMic).toHaveBeenCalled();
    expect(player.stop).toHaveBeenCalled();
    const before = state();
    gate.resolve(OPEN);
    await flush();
    expect(state()).toBe(before);
  });
});
