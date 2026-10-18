import { IntentType, MessageRole, type VacancyResult } from '@hira/contracts';
import { SessionStatus } from '../auth/session-status';
import { CallPhase } from './call-phase';
import { LAST_CALL_CAPTIONS } from './call.constants';

const SEARCHING = new Set<string>([IntentType.Search, IntentType.Refine, IntentType.Compare]);

export interface Caption {
  id: string;
  role: string;
  content: string;
}

export interface CallViewState {
  phase: CallPhase;
  captions: Caption[];
  cards: VacancyResult[];
  searching: boolean;
}

/** Call screen before Start. */
export function emptyCall(): CallViewState {
  return { phase: CallPhase.Idle, captions: [], cards: [], searching: false };
}

/** Microphone is open. */
export function beginListening(state: CallViewState): CallViewState {
  return { ...state, phase: CallPhase.Listening, searching: false };
}

/** A finished utterance is on its way to core-api. */
export function onFinalTranscript(state: CallViewState, id: string, text: string): CallViewState {
  return {
    ...state,
    phase: CallPhase.Thinking,
    searching: true,
    cards: [],
    captions: pushCaption(state.captions, { id, role: MessageRole.User, content: text }),
  };
}

/** Same SSE names as a chat turn. Empty results do not draw cards. */
export function reduceCallEvent(state: CallViewState, raw: { event: string; data: unknown }): CallViewState {
  if (raw.event === 'intent') return onIntent(state, raw.data);
  if (raw.event === 'results') return { ...state, searching: false, cards: asResults(raw.data) };
  if (raw.event === 'token') return appendAssistant(state, delta(raw.data));
  if (raw.event === 'done') return { ...state, phase: CallPhase.Speaking, searching: false };
  if (raw.event === 'error') return { ...state, phase: CallPhase.Listening, searching: false, cards: [] };
  return state;
}

/** End returns the screen to idle. */
export function finishCall(): CallViewState {
  return emptyCall();
}

/** Demo stays in the text chat. */
export function canStartCall(status: SessionStatus): boolean {
  return status === SessionStatus.Account;
}

/** The typed fallback is only there when the browser has no recognizer. */
export function showTypeInstead(speechAvailable: boolean): boolean {
  return !speechAvailable;
}

function onIntent(state: CallViewState, data: unknown): CallViewState {
  const intentType = isRecord(data) && typeof data.intentType === 'string' ? data.intentType : '';
  return { ...state, searching: SEARCHING.has(intentType) };
}

function appendAssistant(state: CallViewState, text: string): CallViewState {
  const last = state.captions.at(-1);
  if (last?.role !== MessageRole.Assistant) {
    return { ...state, captions: pushCaption(state.captions, { id: 'live', role: MessageRole.Assistant, content: text }) };
  }
  const captions = state.captions.slice(0, -1);
  return { ...state, captions: [...captions, { ...last, content: last.content + text }] };
}

function pushCaption(captions: readonly Caption[], caption: Caption): Caption[] {
  return [...captions, caption].slice(-LAST_CALL_CAPTIONS);
}

function asResults(data: unknown): VacancyResult[] {
  if (!isRecord(data) || !Array.isArray(data.results)) return [];
  return data.results as VacancyResult[];
}

function delta(data: unknown): string {
  if (!isRecord(data) || typeof data.delta !== 'string') return '';
  return data.delta;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
