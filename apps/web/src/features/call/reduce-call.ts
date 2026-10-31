import { IntentType, MessageRole, type DocumentDraftDto, type VacancyResult } from '@hira/contracts';
import { SessionStatus } from '../auth/session-status';
import { asDraft } from '../chat/reduce-chat-event';
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
  /** Latest file draft Hira proposed in this call. */
  draft: DocumentDraftDto | null;
  /** Error text from the last turn, shown until the next phrase. */
  notice: string | null;
}

/** Call screen before Start. */
export function emptyCall(): CallViewState {
  return { phase: CallPhase.Idle, captions: [], cards: [], searching: false, draft: null, notice: null };
}

/** Microphone is open. */
export function beginListening(state: CallViewState): CallViewState {
  return { ...state, phase: CallPhase.Listening, searching: false };
}

/** A phrase is being read, or the reply is on its way. */
export function beginThinking(state: CallViewState): CallViewState {
  return { ...state, phase: CallPhase.Thinking, notice: null };
}

/** The first piece of the reply started playing. */
export function beginSpeaking(state: CallViewState): CallViewState {
  return { ...state, phase: CallPhase.Speaking, searching: false };
}

/** A finished utterance is on its way to core-api. Searching waits for a search intent. */
export function onFinalTranscript(state: CallViewState, id: string, text: string): CallViewState {
  return {
    ...state,
    phase: CallPhase.Thinking,
    searching: false,
    cards: [],
    notice: null,
    captions: pushCaption(state.captions, { id, role: MessageRole.User, content: text }),
  };
}

/** Same SSE names as a chat turn. Empty results do not draw cards. */
export function reduceCallEvent(
  state: CallViewState,
  raw: { event: string; data: unknown },
): CallViewState {
  if (raw.event === 'intent') return onIntent(state, raw.data);
  if (raw.event === 'results') return { ...state, searching: false, cards: asResults(raw.data) };
  if (raw.event === 'token') return appendAssistant(state, delta(raw.data));
  if (raw.event === 'document-draft') return { ...state, draft: asDraft(raw.data) ?? state.draft };
  if (raw.event === 'done') return { ...state, searching: false };
  if (raw.event === 'error')
    return { ...state, phase: CallPhase.Listening, searching: false, cards: [], notice: errorText(raw.data) };
  return state;
}

/** The user cut Hira off: the screen keeps only the words that were spoken. */
export function cutReply(state: CallViewState, heard: string): CallViewState {
  const last = state.captions.at(-1);
  if (last?.role !== MessageRole.Assistant) return state;
  const earlier = state.captions.slice(0, -1);
  return { ...state, captions: heard.length === 0 ? earlier : [...earlier, { ...last, content: heard }] };
}

/** Drops the draft card after Save or Dismiss. */
export function clearCallDraft(state: CallViewState): CallViewState {
  return { ...state, draft: null };
}

/** End returns the screen to idle. */
export function finishCall(): CallViewState {
  return emptyCall();
}

/** Demo stays in the text chat. */
export function canStartCall(status: SessionStatus): boolean {
  return status === SessionStatus.Account;
}

/** The typed fallback is there when the microphone is blocked or the voice service is down. */
export function showTypeInstead(voiceWorks: boolean): boolean {
  return !voiceWorks;
}

/** Caption speaker as the user reads it. */
export function speakerLabel(role: string): string {
  return role === MessageRole.User ? 'You' : 'Hira';
}

function onIntent(state: CallViewState, data: unknown): CallViewState {
  const intentType = isRecord(data) && typeof data.intentType === 'string' ? data.intentType : '';
  return { ...state, searching: SEARCHING.has(intentType) };
}

function appendAssistant(state: CallViewState, text: string): CallViewState {
  const last = state.captions.at(-1);
  if (last?.role === MessageRole.Assistant) {
    const captions = state.captions.slice(0, -1);
    return { ...state, captions: [...captions, { ...last, content: last.content + text }] };
  }
  const caption = {
    id: `assistant-${state.captions.length}`,
    role: MessageRole.Assistant,
    content: text,
  };
  return { ...state, captions: pushCaption(state.captions, caption) };
}

function pushCaption(captions: readonly Caption[], caption: Caption): Caption[] {
  return [...captions, caption].slice(-LAST_CALL_CAPTIONS);
}

function asResults(data: unknown): VacancyResult[] {
  if (!isRecord(data) || !Array.isArray(data.results)) return [];
  return data.results as VacancyResult[];
}

function errorText(data: unknown): string {
  if (isRecord(data) && typeof data.message === 'string' && data.message.trim().length > 0) return data.message;
  return 'Something went wrong. Try again.';
}

function delta(data: unknown): string {
  if (!isRecord(data) || typeof data.delta !== 'string') return '';
  return data.delta;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
