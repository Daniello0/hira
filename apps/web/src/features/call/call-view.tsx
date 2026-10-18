'use client';

import { MessageRole } from '@hira/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { coreFetch } from '../../common/api/core-api';
import { Button } from '../../common/components/button';
import { loadMe, refreshAccess, tokenForRequest } from '../auth/session';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { SEARCHING_LABEL } from '../chat/chat.constants';
import { postStream } from '../chat/chat-stream';
import { VacancyCard } from '../vacancy/vacancy-card';
import { LISTENING_LABEL, SPEAKING_LABEL, TYPE_INSTEAD_LABEL } from './call.constants';
import { CallPhase } from './call-phase';
import { endCall } from './end-call';
import {
  beginListening,
  canStartCall,
  emptyCall,
  finishCall,
  onFinalTranscript,
  reduceCallEvent,
  resumeCallAfterTurn,
  showTypeInstead,
  type CallViewState,
} from './reduce-call';
import { listen, silence, speak, speechRecognitionAvailable } from './speech';

type Commit = (update: (current: CallViewState) => CallViewState) => CallViewState;

interface CallRefs {
  session: { current: string | null };
  state: { current: CallViewState };
  life: { current: number };
  starting: { current: boolean };
  sending: { current: boolean };
  stopMic: { current: (() => void) | null };
  onPhrase: { current: (text: string) => void };
}

/** Call screen. It is not a chat and it is not in the chat list. */
export function CallView() {
  const status = useSession((state) => state.status);
  const token = useSession((state) => state.accessToken);
  const router = useRouter();
  const [state, setState] = useState<CallViewState>(emptyCall());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const refs = useCallRefs(state, sessionId);
  const speech = speechRecognitionAvailable();
  const commit = (update: (current: CallViewState) => CallViewState): CallViewState => {
    const next = update(refs.state.current);
    refs.state.current = next;
    setState(next);
    return next;
  };
  refs.onPhrase.current = (text) => void say(text, refs, commit);
  useRedirectDemo(status, router);
  useEndOnLeave(sessionId, token, refs);
  useSpeak(state.phase, assistantText(state.captions), refs.life, () =>
    continueListening(commit, refs),
  );
  if (status !== SessionStatus.Account) return <p className="p-6">Loading…</p>;
  return (
    <section className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Call</h1>
      <p className="text-lg">{phaseLabel(state)}</p>
      <CaptionList captions={state.captions} />
      <div className="space-y-3">
        {state.cards.map((card) => (
          <VacancyCard
            key={card.vacancy.id}
            result={card}
            open={openId === card.vacancy.id}
            onToggle={() => setOpenId(openId === card.vacancy.id ? null : card.vacancy.id)}
          />
        ))}
      </div>
      <CallActions
        phase={state.phase}
        speech={speech}
        typed={typed}
        onTyped={setTyped}
        onStart={() => void start(router, refs, setSessionId, commit)}
        onEnd={() => stop(token, refs, setSessionId, commit)}
        onType={() => void say(typed, refs, commit).then(() => setTyped(''))}
      />
    </section>
  );
}

function useCallRefs(state: CallViewState, sessionId: string | null): CallRefs {
  const refs = useRef<CallRefs | null>(null);
  if (refs.current === null) {
    refs.current = {
      session: { current: sessionId },
      state: { current: state },
      life: { current: 0 },
      starting: { current: false },
      sending: { current: false },
      stopMic: { current: null },
      onPhrase: { current: () => undefined },
    };
  }
  return refs.current;
}

function useRedirectDemo(status: SessionStatus, router: ReturnType<typeof useRouter>): void {
  useEffect(() => {
    if (status === SessionStatus.Anonymous) router.replace('/login');
  }, [status, router]);
}

function useEndOnLeave(sessionId: string | null, token: string | null, refs: CallRefs): void {
  const hold = useRef({ sessionId, token });
  hold.current = { sessionId, token };
  useEffect(() => {
    return () => {
      refs.life.current += 1;
      refs.stopMic.current?.();
      refs.stopMic.current = null;
      silence();
      const id = hold.current.sessionId;
      const access = hold.current.token;
      if (id !== null && access !== null) endCall(id, access);
    };
  }, [refs]);
}

function useSpeak(
  phase: CallPhase,
  caption: string,
  life: { current: number },
  onSpoken: () => void,
): void {
  const onSpokenRef = useRef(onSpoken);
  onSpokenRef.current = onSpoken;
  useEffect(() => {
    if (phase !== CallPhase.Speaking) return;
    const stamp = life.current;
    let cancelled = false;
    speak(caption, () => {
      if (cancelled || stamp !== life.current) return;
      onSpokenRef.current();
    });
    return () => {
      cancelled = true;
      silence();
    };
  }, [phase, caption, life]);
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
      {captions.map((caption) => (
        <li key={caption.id}>{caption.content}</li>
      ))}
    </ol>
  );
}

async function start(
  router: ReturnType<typeof useRouter>,
  refs: CallRefs,
  setSessionId: (id: string) => void,
  commit: Commit,
): Promise<void> {
  if (refs.starting.current || refs.state.current.phase !== CallPhase.Idle) return;
  refs.starting.current = true;
  const stamp = refs.life.current;
  try {
    await openStartedCall(router, refs, stamp, setSessionId, commit);
  } finally {
    refs.starting.current = false;
  }
}

async function openStartedCall(
  router: ReturnType<typeof useRouter>,
  refs: CallRefs,
  stamp: number,
  setSessionId: (id: string) => void,
  commit: Commit,
): Promise<void> {
  const token = await liveToken(refs);
  if (!stillHere(stamp, refs)) return;
  if (token === null || !canStartCall(useSession.getState().status)) {
    router.push('/login');
    return;
  }
  const id = await openCall(token);
  if (!keepStartedCall(stamp, refs, id, token)) return;
  if (id === null) {
    router.push('/login');
    return;
  }
  refs.session.current = id;
  setSessionId(id);
  commit(() => beginListening(emptyCall()));
  arm(refs);
}

function stillHere(stamp: number, refs: CallRefs): boolean {
  return stamp === refs.life.current;
}

function keepStartedCall(stamp: number, refs: CallRefs, id: string | null, token: string): boolean {
  if (stillHere(stamp, refs)) return true;
  if (id !== null) endCall(id, token);
  return false;
}

async function openCall(token: string): Promise<string | null> {
  try {
    const response = await coreFetch('/api/v1/calls', { method: 'POST' }, token);
    if (!response.ok) return null;
    const body = (await response.json()) as { id?: string };
    return body.id ?? null;
  } catch {
    return null;
  }
}

async function say(text: string, refs: CallRefs, commit: Commit): Promise<void> {
  const trimmed = text.trim();
  const sessionId = refs.session.current;
  if (
    sessionId === null ||
    trimmed.length === 0 ||
    busy(refs.state.current.phase) ||
    refs.sending.current
  )
    return;
  refs.sending.current = true;
  const stamp = refs.life.current;
  try {
    await speakTurn(sessionId, trimmed, stamp, refs, commit);
  } finally {
    refs.sending.current = false;
  }
}

async function speakTurn(
  sessionId: string,
  text: string,
  stamp: number,
  refs: CallRefs,
  commit: Commit,
): Promise<void> {
  const token = await liveToken(refs);
  if (token === null || !stillHere(stamp, refs) || refs.session.current === null) return;
  refs.stopMic.current?.();
  const captionId = crypto.randomUUID();
  commit((current) => onFinalTranscript(current, captionId, text));
  const opened = await streamTurn(sessionId, text, token, stamp, refs, commit);
  if (!stillHere(stamp, refs) || refs.session.current === null) return;
  const next = commit((current) => resumeCallAfterTurn(current, opened));
  if (next.phase === CallPhase.Listening) arm(refs);
}

function busy(phase: CallPhase): boolean {
  return phase === CallPhase.Thinking || phase === CallPhase.Speaking;
}

async function streamTurn(
  sessionId: string,
  text: string,
  token: string,
  stamp: number,
  refs: CallRefs,
  commit: Commit,
): Promise<boolean> {
  const result = await postStream(`/api/v1/calls/${sessionId}/turns`, text, token, (event) => {
    if (stamp !== refs.life.current) return;
    commit((current) => reduceCallEvent(current, event));
  });
  return result.opened;
}

async function liveToken(refs: CallRefs): Promise<string | null> {
  const session = useSession.getState();
  const decision = await tokenForRequest({
    status: session.status,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    now: Date.now(),
    refresh: () => refreshAccess(fetch, Date.now()),
    loadUser: loadMe,
  });
  if (decision.kind === 'refreshed') {
    session.setAccount(decision.grant, decision.user);
    return decision.grant.accessToken;
  }
  if (decision.kind === 'current') return decision.token;
  endOpenCall(refs, session.accessToken);
  session.setAnonymous();
  return null;
}

function stop(
  token: string | null,
  refs: CallRefs,
  setSessionId: (id: string | null) => void,
  commit: Commit,
): void {
  endOpenCall(refs, token);
  setSessionId(null);
  commit(() => finishCall());
}

function endOpenCall(refs: CallRefs, token: string | null): void {
  refs.life.current += 1;
  const id = refs.session.current;
  refs.session.current = null;
  refs.stopMic.current?.();
  refs.stopMic.current = null;
  silence();
  if (id !== null && token !== null) endCall(id, token);
}

function continueListening(commit: Commit, refs: CallRefs): void {
  commit((current) => (current.phase === CallPhase.Speaking ? beginListening(current) : current));
  if (refs.session.current !== null) arm(refs);
}

function arm(refs: CallRefs): void {
  if (!speechRecognitionAvailable()) return;
  refs.stopMic.current = listen((text) => refs.onPhrase.current(text))?.stop ?? null;
}

function assistantText(captions: CallViewState['captions']): string {
  return (
    [...captions].reverse().find((caption) => caption.role === MessageRole.Assistant)?.content ?? ''
  );
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
  if (props.phase === CallPhase.Idle)
    return (
      <Button type="button" onClick={props.onStart}>
        Start
      </Button>
    );
  return (
    <div className="space-y-3">
      <Button type="button" tone="quiet" onClick={props.onEnd}>
        End
      </Button>
      {showTypeInstead(props.speech) && props.phase === CallPhase.Listening ? (
        <TypeInstead typed={props.typed} onTyped={props.onTyped} onType={props.onType} />
      ) : null}
    </div>
  );
}

function TypeInstead({
  typed,
  onTyped,
  onType,
}: {
  typed: string;
  onTyped: (value: string) => void;
  onType: () => void;
}) {
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onType();
      }}
    >
      <label className="block text-sm text-hira-muted" htmlFor="type-instead">
        {TYPE_INSTEAD_LABEL}
        <textarea
          id="type-instead"
          className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2"
          value={typed}
          onChange={(event) => onTyped(event.target.value)}
        />
      </label>
      <Button type="submit" tone="quiet">
        Send
      </Button>
    </form>
  );
}
