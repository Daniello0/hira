'use client';

import { MessageRole } from '@hira/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { coreFetch } from '../../common/api/core-api';
import { Button } from '../../common/components/button';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { SEARCHING_LABEL } from '../chat/chat.constants';
import { postStream } from '../chat/chat-stream';
import { VacancyCard } from '../vacancy/vacancy-card';
import { LISTENING_LABEL, SPEAKING_LABEL, TYPE_INSTEAD_LABEL } from './call.constants';
import { CallPhase } from './call-phase';
import { endCall } from './end-call';
import { beginListening, canStartCall, emptyCall, finishCall, onFinalTranscript, reduceCallEvent, showTypeInstead, type CallViewState } from './reduce-call';
import { listen, silence, speak, speechRecognitionAvailable } from './speech';

/** Call screen. It is not a chat and it is not in the chat list. */
export function CallView() {
  const status = useSession((state) => state.status);
  const token = useSession((state) => state.accessToken);
  const router = useRouter();
  const [state, setState] = useState<CallViewState>(emptyCall());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const stopMic = useRef<(() => void) | null>(null);
  const sessionRef = useRef<string | null>(null);
  sessionRef.current = sessionId;
  const speech = speechRecognitionAvailable();
  const onPhrase = (text: string) => void say(text, sessionRef, token, setState, stopMic);
  useRedirectDemo(status, router);
  useEndOnLeave(sessionId, token, stopMic);
  useSpeak(state, setState, () => arm(stopMic, onPhrase));
  if (status !== SessionStatus.Account) return <p className="p-6">Loading…</p>;
  return (
    <section className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Call</h1>
      <p className="text-lg">{phaseLabel(state)}</p>
      <CaptionList captions={state.captions} />
      <div className="space-y-3">
        {state.cards.map((card) => (
          <VacancyCard key={card.vacancy.id} result={card} open={openId === card.vacancy.id} onToggle={() => setOpenId(openId === card.vacancy.id ? null : card.vacancy.id)} />
        ))}
      </div>
      <CallActions
        phase={state.phase}
        speech={speech}
        typed={typed}
        onTyped={setTyped}
        onStart={() => void start(status, token, router, sessionRef, setSessionId, setState, stopMic, onPhrase)}
        onEnd={() => stop(sessionRef.current, token, stopMic, setSessionId, setState)}
        onType={() => void say(typed, sessionRef, token, setState, stopMic).then(() => setTyped(''))}
      />
    </section>
  );
}

function useRedirectDemo(status: SessionStatus, router: ReturnType<typeof useRouter>): void {
  useEffect(() => {
    if (status === SessionStatus.Anonymous) router.replace('/login');
  }, [status, router]);
}

function useEndOnLeave(sessionId: string | null, token: string | null, stopMic: { current: (() => void) | null }): void {
  useEffect(() => {
    return () => {
      stopMic.current?.();
      silence();
      if (sessionId !== null && token !== null) endCall(sessionId, token);
    };
  }, [sessionId, token, stopMic]);
}

function useSpeak(state: CallViewState, setState: (value: CallViewState) => void, armMic: () => void): void {
  const spoken = useRef(false);
  useEffect(() => {
    if (state.phase !== CallPhase.Speaking || spoken.current) return;
    spoken.current = true;
    speak(assistantText(state.captions), () => {
      spoken.current = false;
      setState(beginListening(state));
      armMic();
    });
  }, [state, setState, armMic]);
}

function phaseLabel(state: CallViewState): string {
  if (state.phase === CallPhase.Listening) return LISTENING_LABEL;
  if (state.phase === CallPhase.Speaking) return SPEAKING_LABEL;
  if (state.searching) return SEARCHING_LABEL;
  return state.phase === CallPhase.Idle ? 'Ready' : 'Hira is answering';
}

function CaptionList({ captions }: { captions: CallViewState['captions'] }) {
  return (
    <ol className="space-y-2 text-sm" aria-live="polite">
      {captions.map((caption) => <li key={`${caption.id}-${caption.role}`}>{caption.content}</li>)}
    </ol>
  );
}

async function start(
  status: SessionStatus,
  token: string | null,
  router: ReturnType<typeof useRouter>,
  sessionRef: { current: string | null },
  setSessionId: (id: string) => void,
  setState: (value: CallViewState) => void,
  stopMic: { current: (() => void) | null },
  onPhrase: (text: string) => void,
): Promise<void> {
  if (!canStartCall(status) || token === null) {
    router.push('/login');
    return;
  }
  const id = await openCall(token);
  if (id === null) {
    router.push('/login');
    return;
  }
  sessionRef.current = id;
  setSessionId(id);
  setState(beginListening(emptyCall()));
  arm(stopMic, onPhrase);
}

async function openCall(token: string): Promise<string | null> {
  const response = await coreFetch('/api/v1/calls', { method: 'POST' }, token);
  if (!response.ok) return null;
  const body = (await response.json()) as { id?: string };
  return body.id ?? null;
}

async function say(
  text: string,
  sessionRef: { current: string | null },
  token: string | null,
  setState: (update: (current: CallViewState) => CallViewState) => void,
  stopMic: { current: (() => void) | null },
): Promise<void> {
  const trimmed = text.trim();
  const sessionId = sessionRef.current;
  if (sessionId === null || token === null || trimmed.length === 0) return;
  stopMic.current?.();
  setState((current) => onFinalTranscript(current, crypto.randomUUID(), trimmed));
  await postStream(`/api/v1/calls/${sessionId}/turns`, trimmed, token, (event) => {
    setState((current) => reduceCallEvent(current, event));
  });
}

function stop(
  sessionId: string | null,
  token: string | null,
  stopMic: { current: (() => void) | null },
  setSessionId: (id: string | null) => void,
  setState: (value: CallViewState) => void,
): void {
  stopMic.current?.();
  silence();
  if (sessionId !== null && token !== null) endCall(sessionId, token);
  setSessionId(null);
  setState(finishCall());
}

function arm(stopMic: { current: (() => void) | null }, onPhrase: (text: string) => void): void {
  if (!speechRecognitionAvailable()) return;
  stopMic.current = listen(onPhrase)?.stop ?? null;
}

function assistantText(captions: CallViewState['captions']): string {
  return [...captions].reverse().find((caption) => caption.role === MessageRole.Assistant)?.content ?? '';
}

function CallActions(props: {
  phase: CallPhase;
  speech: boolean;
  typed: string;
  onTyped: (value: string) => void;
  onStart: () => void;
  onEnd: () => void;
  onType: () => void;
}) {
  if (props.phase === CallPhase.Idle) return <Button type="button" onClick={props.onStart}>Start</Button>;
  return (
    <div className="space-y-3">
      <Button type="button" tone="quiet" onClick={props.onEnd}>End</Button>
      {showTypeInstead(props.speech) && props.phase === CallPhase.Listening ? <TypeInstead typed={props.typed} onTyped={props.onTyped} onType={props.onType} /> : null}
    </div>
  );
}

function TypeInstead({ typed, onTyped, onType }: { typed: string; onTyped: (value: string) => void; onType: () => void }) {
  return (
    <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); onType(); }}>
      <label className="block text-sm text-hira-muted" htmlFor="type-instead">
        {TYPE_INSTEAD_LABEL}
        <textarea id="type-instead" className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2" value={typed} onChange={(event) => onTyped(event.target.value)} />
      </label>
      <Button type="submit" tone="quiet">Send</Button>
    </form>
  );
}
