'use client';

import type { CreateMessageRequest } from '@hira/contracts';
import { useEffect, useRef, useState } from 'react';
import { SIGN_IN_AGAIN } from '../auth/auth.constants';
import { loadMe } from '../auth/session';
import { accessToken } from '../auth/session-access';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { scheduleSuggestionRefresh } from '../suggestions/suggestion.store';
import { fetchOlder, loadChat } from './chat-api';
import { useChatDraft } from './chat-draft.store';
import { findChat, useChatList } from './chat-list.store';
import { MESSAGE_TOO_LONG, RELOAD_FAILED } from './chat.constants';
import { refreshChatList } from './chat-sidebar';
import { takePendingSend } from './start-chat';
import { postStream, type StreamResult } from './chat-stream';
import { useForeignRemotePreference } from './foreign-remote-preference';
import {
  afterFailedSend,
  prependMessages,
  rejectDraft,
  reloadedTurn,
  releaseTurn,
  shouldApplyHistory,
} from './send-decision';
import { emptyTurn, reduceChatEvent, type LiveTurn } from './reduce-chat-event';
import type { ParsedSse } from './sse-parser';
import { StreamPhase } from './stream-phase';

/** Whether the open chat could be read. */
export type ChatLoadState = 'loading' | 'ready' | 'not-found' | 'failed';

type Latest = { current: LiveTurn };
type SetTurn = (turn: LiveTurn) => void;

/** One open chat: history, draft, composer switches, and the live stream. */
export function useChatScreen(chatId: string) {
  const status = useSession((state) => state.status);
  const [turn, setTurn] = useState<LiveTurn>(emptyTurn());
  const storedDraft = useChatDraft((state) => state.draftFor(chatId));
  const saveDraft = useChatDraft((state) => state.setDraft);
  const [draft, setDraftState] = useState(storedDraft);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [load, setLoad] = useState<ChatLoadState>('loading');
  const [loadedArchived, setLoadedArchived] = useState(false);
  const [useMemory, setUseMemory] = useState(true);
  const [includeForeignRemote, setIncludeForeignRemote] = useForeignRemotePreference();
  const [finishedTurns, setFinishedTurns] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const listed = useChatList((state) => findChat(state, chatId)?.isArchived);
  const latest = useRef(turn);
  const loadingOlder = useRef(false);
  latest.current = turn;
  const ready = load === 'ready';
  const updateDraft = (value: string) => {
    setDraftState(value);
    saveDraft(chatId, value);
  };

  useEffect(() => {
    setDraftState(storedDraft);
  }, [chatId, storedDraft]);

  useEffect(() => {
    if (status === SessionStatus.Unknown) return;
    let cancelled = false;
    setLoad('loading');
    void loadHistory(chatId, () => cancelled, latest, setTurn, setCursor, setLoad, setLoadedArchived);
    return () => {
      cancelled = true;
    };
  }, [chatId, status, attempt]);

  // A first message from the home screen waits here until the new chat is readable.
  useEffect(() => {
    if (!ready) return;
    const pending = takePendingSend(chatId);
    if (pending === null) return;
    setUseMemory(pending.useMemory);
    void send(pending.useMemory);
  }, [ready, chatId]);

  async function send(memory: boolean = useMemory): Promise<void> {
    const decision = rejectDraft(draft, latest.current.phase);
    if (decision === 'too-long') return publish({ ...latest.current, notice: MESSAGE_TOO_LONG }, latest, setTurn);
    if (decision !== 'ok' || !ready) return;
    const body = messageBody(draft.trim(), status === SessionStatus.Account, memory, includeForeignRemote);
    publish({ ...latest.current, phase: StreamPhase.Searching, banner: null, notice: null }, latest, setTurn);
    if (!(await sessionStillOpen(status))) return publish(releaseTurn(latest.current, SIGN_IN_AGAIN), latest, setTurn);
    const result = await postStream(messagePath(chatId), body, (event) =>
      applyEvent(event, latest, setTurn, updateDraft, () => setFinishedTurns((count) => count + 1)),
    );
    await finishSend(result, body.content, chatId, latest, setTurn);
  }

  return {
    turn,
    draft,
    setDraft: updateDraft,
    openIds,
    ready,
    load,
    archived: listed ?? loadedArchived,
    useMemory,
    setUseMemory,
    includeForeignRemote,
    setIncludeForeignRemote,
    finishedTurns,
    retry: () => setAttempt((count) => count + 1),
    toggle: (id: string) => setOpenIds((current) => toggleId(current, id)),
    send: () => send(),
    hasOlder: cursor !== null,
    loadOlder: () => void loadOlderMessages(chatId, cursor, latest, setTurn, setCursor, loadingOlder),
  };
}

function messageBody(content: string, account: boolean, useMemory: boolean, includeForeignRemote: boolean): CreateMessageRequest {
  const body: CreateMessageRequest = { content, includeForeignRemote };
  if (account) body.useMemory = useMemory;
  return body;
}

/** An account whose refresh failed must sign in again; a demo tab always continues. */
async function sessionStillOpen(status: SessionStatus): Promise<boolean> {
  if (status !== SessionStatus.Account) return true;
  await accessToken();
  return useSession.getState().status === SessionStatus.Account;
}

function publish(next: LiveTurn, latest: Latest, setTurn: SetTurn): void {
  latest.current = next;
  setTurn(next);
}

function applyEvent(event: ParsedSse, latest: Latest, setTurn: SetTurn, setDraft: (draft: string) => void, onDone: () => void): void {
  if (event.event === 'user-message') setDraft('');
  publish(reduceChatEvent(latest.current, event), latest, setTurn);
  if (event.event !== 'done' && event.event !== 'error') return;
  void refreshChatList();
  void refreshQuota();
  if (event.event !== 'done') return;
  onDone();
  if (useSession.getState().status === SessionStatus.Account) scheduleSuggestionRefresh();
}

async function loadHistory(
  chatId: string,
  cancelled: () => boolean,
  latest: Latest,
  setTurn: SetTurn,
  setCursor: (cursor: string | null) => void,
  setLoad: (load: ChatLoadState) => void,
  setArchived: (archived: boolean) => void,
): Promise<void> {
  const loaded = await loadChat(chatId);
  if (cancelled()) return;
  if (loaded.kind !== 'ok') return setLoad(loaded.kind);
  if (shouldApplyHistory(latest.current.phase)) {
    publish(emptyTurn(loaded.detail.messages), latest, setTurn);
    setCursor(loaded.detail.nextCursor);
  }
  setArchived(loaded.detail.chat.isArchived);
  useChatList.getState().setOpened(loaded.detail.chat);
  setLoad('ready');
}

async function finishSend(result: StreamResult, text: string, chatId: string, latest: Latest, setTurn: SetTurn): Promise<void> {
  const dropped = result.interrupted || (result.opened && latest.current.phase !== StreamPhase.Idle);
  if (dropped || needsReload(result, text, latest.current)) return replaceFromServer(chatId, latest, setTurn);
  if (result.opened) return;
  if (result.status === 429) void refreshQuota();
  publish({ ...latest.current, phase: StreamPhase.Idle, notice: result.error?.message ?? 'Message was not sent' }, latest, setTurn);
}

function needsReload(result: StreamResult, text: string, turn: LiveTurn): boolean {
  if (result.opened) return false;
  return afterFailedSend({ streamOpened: false, draft: text, messages: turn.messages }) === 'reload';
}

async function replaceFromServer(chatId: string, latest: Latest, setTurn: SetTurn): Promise<void> {
  const loaded = await loadChat(chatId);
  if (loaded.kind !== 'ok') return publish(releaseTurn(latest.current, RELOAD_FAILED), latest, setTurn);
  publish(reloadedTurn(loaded.detail.messages), latest, setTurn);
}

/** Re-reads the account so the sidebar counter matches the server after any turn. */
async function refreshQuota(): Promise<void> {
  const session = useSession.getState();
  if (session.status !== SessionStatus.Account) return;
  const token = await accessToken();
  if (token === null) return;
  const user = await loadMe(token).catch(() => null);
  if (user !== null) useSession.getState().patchUser(user);
}

async function loadOlderMessages(
  chatId: string,
  cursor: string | null,
  latest: Latest,
  setTurn: SetTurn,
  setCursor: (cursor: string | null) => void,
  loading: { current: boolean },
): Promise<void> {
  if (cursor === null || loading.current) return;
  loading.current = true;
  try {
    const page = await fetchOlder(chatId, cursor);
    if (page === null) return;
    publish({ ...latest.current, messages: prependMessages(latest.current.messages, page.items) }, latest, setTurn);
    setCursor(page.nextCursor);
  } catch {
    publish({ ...latest.current, notice: 'Could not load older messages' }, latest, setTurn);
  } finally {
    loading.current = false;
  }
}

function messagePath(chatId: string): string {
  return `/api/v1/chats/${chatId}/messages`;
}

function toggleId(openIds: readonly string[], id: string): string[] {
  if (openIds.includes(id)) return openIds.filter((item) => item !== id);
  return [...openIds, id];
}
