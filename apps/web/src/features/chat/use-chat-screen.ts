'use client';

import { useEffect, useRef, useState } from 'react';
import { loadMe, refreshAccess, shouldRepeatPost } from '../auth/session';
import { useSession } from '../auth/session.store';
import { INTERRUPTED_ANSWER, MAX_MESSAGE_LENGTH } from './chat.constants';
import { fetchChat, fetchOlder } from './chat-api';
import { refreshChatList } from './chat-sidebar';
import { postStream, type StreamResult } from './chat-stream';
import { afterFailedSend, answerInterrupted } from './send-decision';
import { canSubmit, emptyTurn, reduceChatEvent, type LiveTurn } from './reduce-chat-event';
import type { ParsedSse } from './sse-parser';
import { StreamPhase } from './stream-phase';

/** One open chat: history, draft, and the live stream. */
export function useChatScreen(chatId: string) {
  const token = useSession((state) => state.accessToken);
  const [turn, setTurn] = useState<LiveTurn>(emptyTurn());
  const [draft, setDraft] = useState('');
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const latest = useRef(turn);
  latest.current = turn;

  useEffect(() => {
    let cancelled = false;
    void fetchChat(token, chatId).then((detail) => {
      if (cancelled || detail === null) return;
      publish(emptyTurn(detail.messages), latest, setTurn);
      setCursor(detail.nextCursor);
    });
    return () => {
      cancelled = true;
    };
  }, [chatId, token]);

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!canSubmit(latest.current.phase) || text.length === 0 || text.length > MAX_MESSAGE_LENGTH) return;
    publish({ ...latest.current, phase: StreamPhase.Searching, banner: null, notice: null }, latest, setTurn);
    const result = await sendWithRetry(chatId, text, token, (event) => applyEvent(event, latest, setTurn, setDraft));
    await finishSend(result, text, chatId, token, latest, setTurn);
  }

  function loadOlder(): void {
    void loadOlderMessages(chatId, token, cursor, latest, setTurn, setCursor);
  }

  return {
    turn,
    draft,
    setDraft,
    openIds,
    toggle: (id: string) => setOpenIds((current) => toggleId(current, id)),
    send,
    hasOlder: cursor !== null,
    loadOlder,
  };
}

function publish(next: LiveTurn, latest: { current: LiveTurn }, setTurn: (turn: LiveTurn) => void): void {
  latest.current = next;
  setTurn(next);
}

function applyEvent(event: ParsedSse, latest: { current: LiveTurn }, setTurn: (turn: LiveTurn) => void, setDraft: (draft: string) => void): void {
  if (event.event === 'user-message') setDraft('');
  publish(reduceChatEvent(latest.current, event), latest, setTurn);
  if (event.event === 'done' || event.event === 'error') void refreshChatList(useSession.getState().accessToken);
  if (event.event === 'done') void refreshQuota();
}

async function sendWithRetry(chatId: string, text: string, token: string | null, onEvent: (event: ParsedSse) => void): Promise<StreamResult> {
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
  if (result.interrupted) {
    await replaceFromServer(chatId, token, latest, setTurn);
    return;
  }
  if (result.opened) return;
  const decision = afterFailedSend({ streamOpened: false, draft: text, messages: latest.current.messages });
  if (decision === 'reload') {
    await replaceFromServer(chatId, token, latest, setTurn);
    return;
  }
  publish({ ...latest.current, phase: StreamPhase.Idle, notice: result.error?.message ?? 'Message was not sent' }, latest, setTurn);
}

async function replaceFromServer(chatId: string, token: string | null, latest: { current: LiveTurn }, setTurn: (turn: LiveTurn) => void): Promise<void> {
  const detail = await fetchChat(token, chatId);
  if (detail === null) return;
  const notice = answerInterrupted(detail.messages) ? INTERRUPTED_ANSWER : null;
  publish({ ...emptyTurn(detail.messages), notice }, latest, setTurn);
}

async function refreshQuota(): Promise<void> {
  const session = useSession.getState();
  if (session.accessToken === null || session.expiresAt === null) return;
  const user = await loadMe(session.accessToken);
  if (user !== null) session.setAccount({ accessToken: session.accessToken, expiresAt: session.expiresAt }, user);
}

async function loadOlderMessages(
  chatId: string,
  token: string | null,
  cursor: string | null,
  latest: { current: LiveTurn },
  setTurn: (turn: LiveTurn) => void,
  setCursor: (cursor: string | null) => void,
): Promise<void> {
  if (cursor === null) return;
  const page = await fetchOlder(token, chatId, cursor);
  if (page === null) return;
  publish({ ...latest.current, messages: [...page.items, ...latest.current.messages] }, latest, setTurn);
  setCursor(page.nextCursor);
}

function messagePath(chatId: string): string {
  return `/api/v1/chats/${chatId}/messages`;
}

function toggleId(openIds: readonly string[], id: string): string[] {
  if (openIds.includes(id)) return openIds.filter((item) => item !== id);
  return [...openIds, id];
}
