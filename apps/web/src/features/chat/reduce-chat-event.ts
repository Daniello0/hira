import {
  DocumentFormat,
  IntentType,
  MessageRole,
  type ChatMessageView,
  type DocumentDraftDto,
  type RetrievalDiagnostics,
  type SearchIntent,
  type VacancyResult,
} from '@hira/contracts';
import { RATE_LIMIT_ERROR_CODE, SIGN_UP_BANNER } from './chat.constants';
import { StreamPhase } from './stream-phase';

const SEARCHING = new Set<string>([IntentType.Search, IntentType.Refine, IntentType.Compare]);

export interface LiveTurn {
  phase: StreamPhase;
  messages: ChatMessageView[];
  pendingText: string;
  pendingResults: VacancyResult[];
  intent: SearchIntent | null;
  diagnostics: RetrievalDiagnostics | null;
  banner: string | null;
  notice: string | null;
  /** Draft that arrived in this turn, before its assistant message. */
  pendingDraft: DocumentDraftDto | null;
  /** Drafts keyed by the assistant message they belong to. They are not stored on the server. */
  drafts: Record<string, DocumentDraftDto>;
}

/** Empty live turn. History can already be loaded. */
export function emptyTurn(messages: readonly ChatMessageView[] = []): LiveTurn {
  const panel = panelFromHistory(messages);
  return {
    phase: StreamPhase.Idle,
    messages: [...messages],
    pendingText: '',
    pendingResults: [],
    intent: panel.intent,
    diagnostics: panel.diagnostics,
    banner: null,
    notice: null,
    pendingDraft: null,
    drafts: {},
  };
}

/** Applies one SSE event. Unknown events leave the turn unchanged. */
export function reduceChatEvent(state: LiveTurn, raw: { event: string; data: unknown }): LiveTurn {
  if (raw.event === 'user-message') return onUser(state, raw.data);
  if (raw.event === 'intent') return onIntent(state, raw.data);
  if (raw.event === 'results') return onResults(state, raw.data);
  if (raw.event === 'token') return onToken(state, raw.data);
  if (raw.event === 'document-draft') return onDraft(state, raw.data);
  if (raw.event === 'assistant-message') return onAssistant(state, raw.data);
  if (raw.event === 'done') return finish(state);
  if (raw.event === 'error') return onError(state, raw.data);
  return state;
}

/** Latest user intent stored on the chat, for the panel after a reload. */
export function panelFromHistory(messages: readonly ChatMessageView[]): { intent: SearchIntent | null; diagnostics: RetrievalDiagnostics | null } {
  const user = [...messages].reverse().find((item) => item.role === MessageRole.User && item.intent !== undefined);
  return { intent: user?.intent ?? null, diagnostics: user?.diagnostics ?? null };
}

/** The composer accepts another message only between turns. */
export function canSubmit(phase: StreamPhase): boolean {
  return phase === StreamPhase.Idle;
}

function onUser(state: LiveTurn, data: unknown): LiveTurn {
  const message = asMessage(data);
  if (message === null) return state;
  const messages = state.messages.some((item) => item.id === message.id) ? state.messages : [...state.messages, message];
  return { ...state, phase: StreamPhase.Searching, messages, pendingText: '', pendingResults: [], pendingDraft: null };
}

function onIntent(state: LiveTurn, data: unknown): LiveTurn {
  const intent = asIntent(data);
  if (intent === null) return state;
  const phase = SEARCHING.has(intent.intentType) ? StreamPhase.Searching : StreamPhase.Writing;
  return { ...state, intent, phase };
}

function onResults(state: LiveTurn, data: unknown): LiveTurn {
  return {
    ...state,
    phase: StreamPhase.Writing,
    pendingResults: asResults(data),
    diagnostics: asDiagnostics(data) ?? state.diagnostics,
  };
}

function onToken(state: LiveTurn, data: unknown): LiveTurn {
  const delta = isRecord(data) && typeof data.delta === 'string' ? data.delta : '';
  return { ...state, phase: StreamPhase.Writing, pendingText: state.pendingText + delta };
}

function onDraft(state: LiveTurn, data: unknown): LiveTurn {
  const draft = asDraft(data);
  return draft === null ? state : { ...state, pendingDraft: draft };
}

function onAssistant(state: LiveTurn, data: unknown): LiveTurn {
  const message = asMessage(data);
  if (message === null) return state;
  const stored = { ...message, content: message.content || state.pendingText, results: message.results ?? state.pendingResults };
  const drafts = state.pendingDraft === null ? state.drafts : { ...state.drafts, [message.id]: state.pendingDraft };
  return { ...state, messages: [...state.messages, stored], pendingText: '', pendingResults: [], pendingDraft: null, drafts };
}

function finish(state: LiveTurn): LiveTurn {
  return { ...state, phase: StreamPhase.Idle, pendingText: '', pendingResults: [], pendingDraft: null };
}

function onError(state: LiveTurn, data: unknown): LiveTurn {
  const code = text(data, 'errorCode');
  return {
    ...state,
    phase: StreamPhase.Idle,
    pendingText: '',
    pendingResults: [],
    pendingDraft: null,
    banner: code === RATE_LIMIT_ERROR_CODE ? SIGN_UP_BANNER : state.banner,
    notice: code === RATE_LIMIT_ERROR_CODE ? null : text(data, 'message') || 'Something went wrong',
  };
}

function asMessage(data: unknown): ChatMessageView | null {
  if (!isRecord(data) || typeof data.id !== 'string' || typeof data.content !== 'string') return null;
  const view: ChatMessageView = {
    id: data.id,
    role: typeof data.role === 'string' ? (data.role as MessageRole) : MessageRole.User,
    content: data.content,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
  };
  if (Array.isArray(data.results)) view.results = data.results as VacancyResult[];
  return view;
}

/** Validates the `document-draft` payload. Shared with the call screen. */
export function asDraft(data: unknown): DocumentDraftDto | null {
  if (!isRecord(data) || typeof data.title !== 'string' || typeof data.content !== 'string') return null;
  return {
    title: data.title,
    format: data.format === DocumentFormat.Txt ? DocumentFormat.Txt : DocumentFormat.Md,
    content: data.content,
    targetDocumentId: typeof data.targetDocumentId === 'string' ? data.targetDocumentId : null,
    targetTitle: typeof data.targetTitle === 'string' ? data.targetTitle : null,
  };
}

function asIntent(data: unknown): SearchIntent | null {
  if (!isRecord(data) || typeof data.intentType !== 'string') return null;
  return data as unknown as SearchIntent;
}

function asResults(data: unknown): VacancyResult[] {
  if (!isRecord(data) || !Array.isArray(data.results)) return [];
  return data.results as VacancyResult[];
}

function asDiagnostics(data: unknown): RetrievalDiagnostics | null {
  if (!isRecord(data) || !isRecord(data.diagnostics)) return null;
  return data.diagnostics as unknown as RetrievalDiagnostics;
}

function text(data: unknown, key: string): string {
  if (!isRecord(data) || typeof data[key] !== 'string') return '';
  return data[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
