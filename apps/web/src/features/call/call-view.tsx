'use client';

import { MessageRole } from '@hira/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../../common/api/authed-fetch';
import { Button } from '../../common/components/button';
import { accessToken } from '../auth/session-access';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { SEARCHING_LABEL } from '../chat/chat.constants';
import { postStream } from '../chat/chat-stream';
import { DocumentDraftCard } from '../document-draft/document-draft-card';
import { scheduleSuggestionRefresh } from '../suggestions/suggestion.store';
import { VacancyCard } from '../vacancy/vacancy-card';
import { CALL_START_FAILED, LISTENING_LABEL, MIC_DENIED_MESSAGE, RELISTEN_DELAY_MS, SPEAKING_LABEL } from './call.constants';
import { CaptionList, LanguageSelect, TypeInstead } from './call-parts';
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
import { recognitionLang, SpeechLanguage, synthesisLang } from './speech-language';

type Commit = (update: (current: CallViewState) => CallViewState) => CallViewState;
type OpenCall = { kind: 'ok'; id: string } | { kind: 'unauthorized' } | { kind: 'failed' };

interface CallRefs {
  session: { current: string | null };
  state: { current: CallViewState };
  life: { current: number };
  starting: { current: boolean };
  sending: { current: boolean };
  stopMic: { current: (() => void) | null };
  onPhrase: { current: (text: string) => void };
  onMicDenied: { current: () => void };
  language: { current: SpeechLanguage };
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
  const [micDenied, setMicDenied] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [language, setLanguage] = useState(SpeechLanguage.Auto);
  const refs = useCallRefs(state, sessionId);
  const speech = speechRecognitionAvailable();
  const commit: Commit = (update) => {
    const next = update(refs.state.current);
    refs.state.current = next;
    setState(next);
    return next;
  };
  refs.onPhrase.current = (text) => void say(text, refs, commit);
  refs.onMicDenied.current = () => setMicDenied(true);
  refs.language.current = language;
  useRedirectDemo(status, router);
  useEndOnLeave(sessionId, token, refs);
  const spoken = assistantText(state.captions);
  useSpeak(state.phase, spoken, synthesisLang(language, spoken), refs.life, () => continueListening(commit, refs));
  if (status !== SessionStatus.Account) return <p className="p-6">Loading…</p>;
  const onStart = () => {
    setStartError(null);
    void start(router, refs, setSessionId, commit, setStartError);
  };
  return (
    <section className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Call</h1>
        <LanguageSelect value={language} onChange={setLanguage} />
      </div>
      <p className="text-lg">{phaseLabel(state)}</p>
      {startError !== null ? <p role="alert">{startError}</p> : null}
      {micDenied && state.phase !== CallPhase.Idle ? <p role="alert" className="text-sm">{MIC_DENIED_MESSAGE}</p> : null}
      {state.notice !== null ? <p role="alert" className="text-sm">{state.notice}</p> : null}
      <CaptionList captions={state.captions} />
      {state.draft !== null ? <DocumentDraftCard key={`${state.draft.title}-${state.draft.content.length}`} draft={state.draft} /> : null}
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
        typeInstead={showTypeInstead(speech, micDenied)}
        typed={typed}
        onTyped={setTyped}
        onStart={onStart}
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
      onMicDenied: { current: () => undefined },
      language: { current: SpeechLanguage.Auto },
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

function useSpeak(phase: CallPhase, caption: string, lang: string, life: { current: number }, onSpoken: () => void): void {
  const onSpokenRef = useRef(onSpoken);
  onSpokenRef.current = onSpoken;
  useEffect(() => {
    if (phase !== CallPhase.Speaking) return;
    const stamp = life.current;
    let cancelled = false;
    speak(caption, lang, () => {
      if (cancelled || stamp !== life.current) return;
      onSpokenRef.current();
    });
    return () => {
      cancelled = true;
      silence();
    };
  }, [phase, caption, lang, life]);
}

function phaseLabel(state: CallViewState): string {
  if (state.phase === CallPhase.Listening) return LISTENING_LABEL;
  if (state.phase === CallPhase.Speaking) return SPEAKING_LABEL;
  if (state.searching) return SEARCHING_LABEL;
  return state.phase === CallPhase.Idle ? 'Ready' : 'Hira is answering';
}

async function start(
  router: ReturnType<typeof useRouter>,
  refs: CallRefs,
  setSessionId: (id: string) => void,
  commit: Commit,
  setError: (value: string | null) => void,
): Promise<void> {
  if (refs.starting.current || refs.state.current.phase !== CallPhase.Idle) return;
  refs.starting.current = true;
  const stamp = refs.life.current;
  try {
    await openStartedCall(router, refs, stamp, setSessionId, commit, setError);
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
  setError: (value: string | null) => void,
): Promise<void> {
  if (!(await sessionAlive()) || !canStartCall(useSession.getState().status)) return router.push('/login');
  const opened = await openCall();
  if (!keepStartedCall(stamp, refs, opened)) return;
  if (opened.kind === 'unauthorized') return router.push('/login');
  if (opened.kind === 'failed') return setError(CALL_START_FAILED);
  refs.session.current = opened.id;
  setSessionId(opened.id);
  commit(() => beginListening(emptyCall()));
  arm(refs, commit);
}

function stillHere(stamp: number, refs: CallRefs): boolean {
  return stamp === refs.life.current;
}

function keepStartedCall(stamp: number, refs: CallRefs, opened: OpenCall): boolean {
  if (stillHere(stamp, refs)) return true;
  const token = useSession.getState().accessToken;
  if (opened.kind === 'ok' && token !== null) endCall(opened.id, token);
  return false;
}

async function openCall(): Promise<OpenCall> {
  try {
    const response = await authedFetch('/api/v1/calls', { method: 'POST' });
    if (response.status === 401) return { kind: 'unauthorized' };
    if (!response.ok) return { kind: 'failed' };
    const body = (await response.json()) as { id?: string };
    return body.id === undefined ? { kind: 'failed' } : { kind: 'ok', id: body.id };
  } catch {
    return { kind: 'failed' };
  }
}

async function say(text: string, refs: CallRefs, commit: Commit): Promise<void> {
  const trimmed = text.trim();
  const sessionId = refs.session.current;
  if (sessionId === null || trimmed.length === 0 || busy(refs.state.current.phase) || refs.sending.current) return;
  refs.sending.current = true;
  const stamp = refs.life.current;
  try {
    await speakTurn(sessionId, trimmed, stamp, refs, commit);
  } finally {
    refs.sending.current = false;
  }
}

async function speakTurn(sessionId: string, text: string, stamp: number, refs: CallRefs, commit: Commit): Promise<void> {
  if (!(await sessionAlive())) return endOpenCall(refs, null);
  if (!stillHere(stamp, refs) || refs.session.current === null) return;
  refs.stopMic.current?.();
  refs.stopMic.current = null;
  commit((current) => onFinalTranscript(current, crypto.randomUUID(), text));
  const opened = await streamTurn(sessionId, text, stamp, refs, commit);
  if (!stillHere(stamp, refs) || refs.session.current === null) return;
  const next = commit((current) => resumeCallAfterTurn(current, opened));
  if (next.phase === CallPhase.Listening) arm(refs, commit);
}

function busy(phase: CallPhase): boolean {
  return phase === CallPhase.Thinking || phase === CallPhase.Speaking;
}

async function streamTurn(sessionId: string, text: string, stamp: number, refs: CallRefs, commit: Commit): Promise<boolean> {
  const result = await postStream(`/api/v1/calls/${sessionId}/turns`, { content: text }, (event) => {
    if (stamp !== refs.life.current) return;
    commit((current) => reduceCallEvent(current, event));
    if (event.event === 'done') scheduleSuggestionRefresh();
  });
  if (!result.opened && stillHere(stamp, refs)) {
    const notice = result.error?.message ?? 'Hira did not answer. Try again.';
    commit((current) => ({ ...current, notice }));
  }
  return result.opened;
}

/** `false` when the account session ended; the access token is refreshed on the way. */
async function sessionAlive(): Promise<boolean> {
  await accessToken();
  return useSession.getState().status === SessionStatus.Account;
}

function stop(token: string | null, refs: CallRefs, setSessionId: (id: string | null) => void, commit: Commit): void {
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
  const access = token ?? useSession.getState().accessToken;
  if (id !== null && access !== null) endCall(id, access);
}

function continueListening(commit: Commit, refs: CallRefs): void {
  commit((current) => (current.phase === CallPhase.Speaking ? beginListening(current) : current));
  if (refs.session.current !== null) arm(refs, commit);
}

/** Opens the microphone. A silent session the browser ends is reopened while the call is listening. */
function arm(refs: CallRefs, commit: Commit): void {
  if (!speechRecognitionAvailable()) return;
  const stamp = refs.life.current;
  const lang = recognitionLang(refs.language.current, refs.state.current.captions);
  refs.stopMic.current =
    listen(lang, {
      onFinal: (text) => refs.onPhrase.current(text),
      onDenied: () => refs.onMicDenied.current(),
      onEnd: () => {
        refs.stopMic.current = null;
        setTimeout(() => relisten(stamp, refs, commit), RELISTEN_DELAY_MS);
      },
    })?.stop ?? null;
}

function relisten(stamp: number, refs: CallRefs, commit: Commit): void {
  const listening = refs.state.current.phase === CallPhase.Listening;
  if (!stillHere(stamp, refs) || refs.session.current === null || !listening || refs.sending.current) return;
  if (refs.stopMic.current === null) arm(refs, commit);
}

function assistantText(captions: CallViewState['captions']): string {
  return [...captions].reverse().find((caption) => caption.role === MessageRole.Assistant)?.content ?? '';
}

function CallActions(props: {
  phase: CallPhase;
  typeInstead: boolean;
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
      {props.typeInstead && props.phase === CallPhase.Listening ? (
        <TypeInstead typed={props.typed} onTyped={props.onTyped} onType={props.onType} />
      ) : null}
    </div>
  );
}
