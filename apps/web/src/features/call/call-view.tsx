'use client';

import { PLAN_LIMITS } from '@hira/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Phone, PhoneOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '../../common/api/authed-fetch';
import { Button, buttonClass } from '../../common/components/button';
import { AlertText, MutedText, SkeletonList } from '../../common/components/feedback';
import { AppPage } from '../shell/app-header';
import { refreshAccount } from '../auth/refresh-account';
import { accessToken } from '../auth/session-access';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { SEARCHING_LABEL } from '../chat/chat.constants';
import { postStream } from '../chat/chat-stream';
import { DocumentDraftCard } from '../document-draft/document-draft-card';
import { scheduleSuggestionRefresh } from '../suggestions/suggestion.store';
import { VacancyCard } from '../vacancy/vacancy-card';
import type { LanguageChoice } from './call-language';
import { callTurnRequest } from './call-turn';
import { CALL_PLAN_MESSAGE, CALL_START_FAILED, INTERRUPT_HINT, LISTENING_LABEL, MIC_DENIED_MESSAGE, SPEAKING_LABEL, VOICE_DOWN_MESSAGE } from './call.constants';
import { CaptionList, LanguageSelect, PhaseIndicator, TypeInstead } from './call-parts';
import { CallPhase } from './call-phase';
import { endCall } from './end-call';
import { canStartCall, emptyCall, finishCall, showTypeInstead, type CallViewState } from './reduce-call';
import { synthesizeSpeech, transcribePhrase } from './speech-api';
import { startVadMic } from './vad-mic';
import { VoicePlayer, type PlayerContext } from './voice-player';
import { VoiceSession } from './voice-session';

type OpenCall = { kind: 'ok'; id: string } | { kind: 'unauthorized' } | { kind: 'failed' };

/** Call screen. It is not a chat and it is not in the chat list. */
export function CallView() {
  const status = useSession((state) => state.status);
  const allowed = useSession((state) => state.user !== null && PLAN_LIMITS[state.user.plan].call);
  const router = useRouter();
  useEffect(() => {
    if (status === SessionStatus.Anonymous) router.replace('/login');
  }, [status, router]);
  if (status !== SessionStatus.Account) return <div className="p-6"><SkeletonList /></div>;
  if (!allowed) return <CallPlanNotice />;
  return <LiveCall />;
}

function CallPlanNotice() {
  return (
    <AppPage>
      <section className="mx-auto flex w-full max-w-thread flex-col items-center gap-4 px-4 pt-4 pb-6 text-center">
        <PhaseIndicator phase={CallPhase.Idle} label="Calls" />
        <MutedText>{CALL_PLAN_MESSAGE}</MutedText>
        <Link href="/settings/billing" className={buttonClass()}>See plans</Link>
      </section>
    </AppPage>
  );
}

function LiveCall() {
  const router = useRouter();
  const [state, setState] = useState<CallViewState>(emptyCall());
  const [typed, setTyped] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [voiceDown, setVoiceDown] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [language, setLanguage] = useState<LanguageChoice>('auto');
  const live = useLiveCall(state, setState, language, setMicDenied, setVoiceDown);
  const onStart = () => {
    setStartError(null);
    setMicDenied(false);
    setVoiceDown(false);
    void live.start(router, setStartError);
  };
  return (
    <AppPage actions={<LanguageSelect value={language} onChange={setLanguage} />}>
      <section className="mx-auto flex min-h-full w-full max-w-thread flex-col gap-6 px-4 pt-4 pb-6">
        <PhaseIndicator phase={state.phase} label={phaseLabel(state)} />
        {state.phase === CallPhase.Speaking ? <MutedText className="text-center">{INTERRUPT_HINT}</MutedText> : null}
        {startError !== null ? <AlertText className="text-center">{startError}</AlertText> : null}
        {micDenied && state.phase !== CallPhase.Idle ? <AlertText className="text-center">{MIC_DENIED_MESSAGE}</AlertText> : null}
        {voiceDown && state.phase !== CallPhase.Idle ? <AlertText className="text-center">{VOICE_DOWN_MESSAGE}</AlertText> : null}
        {state.notice !== null ? <AlertText className="text-center">{state.notice}</AlertText> : null}
        <CaptionList captions={state.captions} />
        {state.draft !== null ? <DocumentDraftCard key={`${state.draft.title}-${state.draft.content.length}`} draft={state.draft} /> : null}
        <div className="space-y-3">
          {state.cards.map((card) => (
            <div key={card.vacancy.id} className="motion-enter">
              <VacancyCard
                result={card}
                open={openId === card.vacancy.id}
                onToggle={() => setOpenId(openId === card.vacancy.id ? null : card.vacancy.id)}
              />
            </div>
          ))}
        </div>
        <CallActions
          phase={state.phase}
          typeInstead={showTypeInstead(!micDenied && !voiceDown)}
          typed={typed}
          onTyped={setTyped}
          onStart={onStart}
          onEnd={live.end}
          onType={() => {
            void live.sayTyped(typed);
            setTyped('');
          }}
        />
      </section>
    </AppPage>
  );
}

/** Holds the one call this screen has open. Leaving the screen ends it. */
function useLiveCall(
  state: CallViewState,
  setState: (state: CallViewState) => void,
  language: LanguageChoice,
  setMicDenied: (value: boolean) => void,
  setVoiceDown: (value: boolean) => void,
) {
  const latest = useRef(state);
  latest.current = state;
  const choice = useRef(language);
  choice.current = language;
  const voice = useRef<VoiceSession | null>(null);
  const callId = useRef<string | null>(null);
  const starting = useRef(false);
  const commit = (update: (current: CallViewState) => CallViewState) => {
    latest.current = update(latest.current);
    setState(latest.current);
    return latest.current;
  };
  const closeCall = () => {
    voice.current?.close();
    voice.current = null;
    const id = callId.current;
    callId.current = null;
    const token = useSession.getState().accessToken;
    if (id !== null && token !== null) endCall(id, token);
  };
  useEffect(() => closeCall, []);
  return {
    start: async (router: ReturnType<typeof useRouter>, setError: (value: string | null) => void) => {
      if (starting.current || latest.current.phase !== CallPhase.Idle) return;
      starting.current = true;
      // Made inside the click: Safari keeps the sound off for a context made later.
      const player = new VoicePlayer(new AudioContext() as unknown as PlayerContext);
      void player.unlock();
      try {
        await accessToken();
        if (!canStartCall(useSession.getState().status)) return router.push('/login');
        const opened = await openCall();
        if (opened.kind === 'unauthorized') return router.push('/login');
        if (opened.kind === 'failed') return setError(CALL_START_FAILED);
        callId.current = opened.id;
        voice.current = new VoiceSession({
          startMic: startVadMic,
          player,
          transcribe: transcribePhrase,
          synthesize: synthesizeSpeech,
          streamTurn: (text, reply, signal, onEvent) =>
            postStream(`/api/v1/calls/${opened.id}/turns`, callTurnRequest(text, reply), (event) => {
              onEvent(event);
              if (event.event !== 'done') return;
              scheduleSuggestionRefresh();
              void refreshAccount();
            }, signal),
          commit,
          choice: () => choice.current,
          browserLanguage: () => (typeof navigator === 'undefined' ? undefined : navigator.language),
          onMicBlocked: () => setMicDenied(true),
          onVoiceTrouble: () => setVoiceDown(true),
        });
        await voice.current.open();
      } finally {
        starting.current = false;
      }
    },
    end: () => {
      closeCall();
      commit(() => finishCall());
    },
    sayTyped: (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || voice.current === null) return Promise.resolve();
      return voice.current.sayTyped(trimmed);
    },
  };
}

function phaseLabel(state: CallViewState): string {
  if (state.phase === CallPhase.Listening) return LISTENING_LABEL;
  if (state.phase === CallPhase.Speaking) return SPEAKING_LABEL;
  if (state.searching) return SEARCHING_LABEL;
  return state.phase === CallPhase.Idle ? 'Ready' : 'Hira is answering';
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

function CallActions(props: {
  phase: CallPhase;
  typeInstead: boolean;
  typed: string;
  onTyped: (value: string) => void;
  onStart: () => void;
  onEnd: () => void;
  onType: () => void;
}) {
  if (props.phase === CallPhase.Idle) {
    return (
      <div className="mt-auto flex justify-center">
        <Button onClick={props.onStart}><Phone className="size-icon-sm" aria-hidden="true" /> Start</Button>
      </div>
    );
  }
  return (
    <div className="mt-auto space-y-3">
      {props.typeInstead && props.phase === CallPhase.Listening ? (
        <TypeInstead typed={props.typed} onTyped={props.onTyped} onType={props.onType} />
      ) : null}
      <div className="flex justify-center">
        <Button variant="danger" onClick={props.onEnd}><PhoneOff className="size-icon-sm" aria-hidden="true" /> End</Button>
      </div>
    </div>
  );
}
