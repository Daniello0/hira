'use client';

import { useEffect, useRef, useState } from 'react';
import { SIGN_IN_AGAIN } from '../auth/auth.constants';
import { loadMe, refreshAccess, shouldRepeatPost, tokenForRequest } from '../auth/session';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { fetchChat, fetchOlder } from './chat-api';
import { useChatDraft } from './chat-draft.store';
import { MESSAGE_TOO_LONG, RELOAD_FAILED } from './chat.constants';
import { refreshChatList } from './chat-sidebar';
import { postStream, type StreamResult } from './chat-stream';
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

/** One open chat: history, draft, and the live stream. */
export function useChatScreen(chatId: string) {
  const token = useSession((state) => state.accessToken);
  const status = useSession((state) => state.status);
  const [turn, setTurn] = useState<LiveTurn>(emptyTurn());
  const storedDraft = useChatDraft((state) => state.draftFor(chatId));
  const saveDraft = useChatDraft((state) => state.setDraft);
  const [draft, setDraftState] = useState(storedDraft);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef(turn);
  const tokenRef = useRef(token);
  const loadingOlder = useRef(false);
  latest.current = turn;
  tokenRef.current = token;

  useEffect(() => {
    setDraftState(storedDraft);
  }, [chatId, storedDraft]);

  useEffect(() => {
    if (status === SessionStatus.Unknown) return;
    let cancelled = false;
    void loadHistory(
      tokenRef.current,
      chatId,
      () => cancelled,
      latest,
      setTurn,
      setCursor,
      setReady,
    );
    return () => {
      cancelled = true;
    };
  }, [chatId, status]);

  async function send(): Promise<void> {
    const decision = rejectDraft(draft, latest.current.phase);
    if (decision === 'too-long') {
      publish({ ...latest.current, notice: MESSAGE_TOO_LONG }, latest, setTurn);
      return;
    }
    if (decision !== 'ok' || !ready) return;
    const text = draft.trim();
    publish(
      { ...latest.current, phase: StreamPhase.Searching, banner: null, notice: null },
      latest,
      setTurn,
    );
    const access = await bearerForSend();
    if (access.stop) {
      publish(releaseTurn(latest.current, SIGN_IN_AGAIN), latest, setTurn);
      return;
    }
    const result = await sendWithRetry(chatId, text, access.token, (event) =>
      applyEvent(event, latest, setTurn, (value) => {
        setDraftState(value);
        saveDraft(chatId, value);
      }),
    );
    await finishSend(result, text, chatId, useSession.getState().accessToken, latest, setTurn);
  }

  function loadOlder(): void {
    void loadOlderMessages(chatId, token, cursor, latest, setTurn, setCursor, loadingOlder);
  }

  return {
    turn,
    draft,
    setDraft: (value: string) => {
      setDraftState(value);
      saveDraft(chatId, value);
    },
    openIds,
    ready,
    toggle: (id: string) => setOpenIds((current) => toggleId(current, id)),
    send,
    hasOlder: cursor !== null,
    loadOlder,
  };
}

function publish(
  next: LiveTurn,
  latest: { current: LiveTurn },
  setTurn: (turn: LiveTurn) => void,
): void {
  latest.current = next;
  setTurn(next);
}

function applyEvent(
  event: ParsedSse,
  latest: { current: LiveTurn },
  setTurn: (turn: LiveTurn) => void,
  setDraft: (draft: string) => void,
): void {
  if (event.event === 'user-message') setDraft('');
  publish(reduceChatEvent(latest.current, event), latest, setTurn);
  if (event.event === 'done' || event.event === 'error')
    void refreshChatList(useSession.getState().accessToken);
  if (event.event === 'done') void refreshQuota();
}

async function loadHistory(
  token: string | null,
  chatId: string,
  cancelled: () => boolean,
  latest: { current: LiveTurn },
  setTurn: (turn: LiveTurn) => void,
  setCursor: (cursor: string | null) => void,
  setReady: (ready: boolean) => void,
): Promise<void> {
  try {
    const detail = await fetchChat(token, chatId);
    if (cancelled()) return;
    if (detail !== null && shouldApplyHistory(latest.current.phase)) {
      publish(emptyTurn(detail.messages), latest, setTurn);
      setCursor(detail.nextCursor);
    }
    setReady(true);
  } catch {
    if (!cancelled()) setReady(true);
  }
}

async function bearerForSend(): Promise<{ stop: true } | { stop: false; token: string | null }> {
  const session = useSession.getState();
  const decision = await tokenForRequest({
    status: session.status,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    now: Date.now(),
    refresh: () => refreshAccess(fetch, Date.now()),
    loadUser: loadMe,
  });
  if (decision.kind === 'stop') {
    session.setAnonymous();
    return { stop: true };
  }
  if (decision.kind === 'refreshed') {
    session.setAccount(decision.grant, decision.user);
    return { stop: false, token: decision.grant.accessToken };
  }
  return { stop: false, token: decision.token };
}

async function sendWithRetry(
  chatId: string,
  text: string,
  token: string | null,
  onEvent: (event: ParsedSse) => void,
): Promise<StreamResult> {
  const first = await postStream(messagePath(chatId), text, token, onEvent);
  if (!shouldRepeatPost(first.status, first.opened)) return first;
  const grant = await refreshAccess(fetch, Date.now());
  if (grant === null) return first;
  const user = await loadMe(grant.accessToken);
  if (user === null) return first;
  useSession.getState().setAccount(grant, user);
  return postStream(messagePath(chatId), text, grant.accessToken, onEvent);
}

async function finishSend(
  result: StreamResult,
  text: string,
  chatId: string,
  token: string | null,
  latest: { current: LiveTurn },
  setTurn: (turn: LiveTurn) => void,
): Promise<void> {
  const dropped =
    result.interrupted || (result.opened && latest.current.phase !== StreamPhase.Idle);
  if (dropped || needsReload(result, text, latest.current)) {
    await replaceFromServer(chatId, token, latest, setTurn);
    return;
  }
  if (result.opened) return;
  publish(
    {
      ...latest.current,
      phase: StreamPhase.Idle,
      notice: result.error?.message ?? 'Message was not sent',
    },
    latest,
    setTurn,
  );
}

function needsReload(result: StreamResult, text: string, turn: LiveTurn): boolean {
  if (result.opened) return false;
  return (
    afterFailedSend({ streamOpened: false, draft: text, messages: turn.messages }) === 'reload'
  );
}

async function replaceFromServer(
  chatId: string,
  token: string | null,
  latest: { current: LiveTurn },
  setTurn: (turn: LiveTurn) => void,
): Promise<void> {
  try {
    const detail = await fetchChat(token, chatId);
    if (detail === null) {
      publish(releaseTurn(latest.current, RELOAD_FAILED), latest, setTurn);
      return;
    }
    publish(reloadedTurn(detail.messages), latest, setTurn);
  } catch {
    publish(releaseTurn(latest.current, RELOAD_FAILED), latest, setTurn);
  }
}

async function refreshQuota(): Promise<void> {
  const session = useSession.getState();
  if (session.accessToken === null || session.expiresAt === null) return;
  const user = await loadMe(session.accessToken);
  if (user !== null)
    session.setAccount({ accessToken: session.accessToken, expiresAt: session.expiresAt }, user);
}

async function loadOlderMessages(
  chatId: string,
  token: string | null,
  cursor: string | null,
  latest: { current: LiveTurn },
  setTurn: (turn: LiveTurn) => void,
  setCursor: (cursor: string | null) => void,
  loading: { current: boolean },
): Promise<void> {
  if (cursor === null || loading.current) return;
  loading.current = true;
  try {
    const page = await fetchOlder(token, chatId, cursor);
    if (page === null) return;
    publish(
      { ...latest.current, messages: prependMessages(latest.current.messages, page.items) },
      latest,
      setTurn,
    );
    setCursor(page.nextCursor);
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
