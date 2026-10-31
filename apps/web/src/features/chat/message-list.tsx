'use client';

import type { ChatMessageView, DocumentDraftDto, VacancyResult } from '@hira/contracts';
import { MessageRole } from '@hira/contracts';
import { ArrowDown } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ShimmerText } from '../../common/components/feedback';
import { IconButton } from '../../common/components/icon-button';
import { MarkdownText } from '../../common/components/markdown-text';
import { DocumentDraftCard } from '../document-draft/document-draft-card';
import { SEARCHING_LABEL } from './chat.constants';
import { CopyAction, ReadAloudAction } from './message-actions';
import type { LiveTurn } from './reduce-chat-event';
import { StreamPhase } from './stream-phase';
import { isNearBottom } from './thread-scroll';
import { VacancyCard } from '../vacancy/vacancy-card';

interface MessageListProps {
  turn: LiveTurn;
  openIds: readonly string[];
  onToggle: (id: string) => void;
  onOlder: () => void;
  hasOlder: boolean;
  account: boolean;
}

interface CardProps {
  openIds: readonly string[];
  onToggle: (id: string) => void;
  account: boolean;
}

/** Dialogue column. Cards render as soon as results arrive; new content scrolls into view. */
export function MessageList({ turn, openIds, onToggle, onOlder, hasOlder, account }: MessageListProps) {
  const thread = useThreadScroll(turn);
  const cards = { openIds, onToggle, account };
  return (
    <div className="relative min-h-0 flex-1">
      <div ref={thread.scroller} onScroll={thread.onScroll} className="scroll-thread h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-thread flex-col gap-6 px-4 py-4">
          {hasOlder ? <button type="button" className="self-center text-sm text-ink-tertiary transition-colors hover:text-ink" onClick={onOlder}>Older messages</button> : null}
          {turn.messages.map((message) => (
            <MessageBubble key={message.id} message={message} draft={turn.drafts[message.id] ?? null} cards={cards} />
          ))}
          <LiveBubble turn={turn} cards={cards} />
        </div>
      </div>
      <div inert={!thread.away} className={`motion-swap absolute bottom-3 left-1/2 -translate-x-1/2 ${thread.away ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <IconButton label="Scroll to bottom" shape="round" tone="plain" className="border border-line bg-surface-raised shadow-menu" onClick={thread.toBottom}>
          <ArrowDown size={20} aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
}

/** Follows new text while the reader is at the end; older messages stay put while being read. */
function useThreadScroll(turn: LiveTurn) {
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [away, setAway] = useState(false);
  const last = turn.messages.at(-1);
  const toEnd = useCallback((behavior: ScrollBehavior) => {
    const node = scroller.current;
    if (node !== null) node.scrollTo({ top: node.scrollHeight, behavior });
  }, []);
  useEffect(() => {
    if (last?.role === MessageRole.User) following.current = true;
  }, [last?.id, last?.role]);
  useEffect(() => {
    if (following.current) toEnd('auto');
  }, [last?.id, turn.pendingText, turn.pendingResults.length, turn.phase, toEnd]);
  const onScroll = () => {
    const node = scroller.current;
    if (node === null) return;
    following.current = isNearBottom(node);
    setAway(!following.current);
  };
  const toBottom = () => {
    following.current = true;
    setAway(false);
    toEnd('smooth');
  };
  return { scroller, onScroll, away, toBottom };
}

function MessageBubble({ message, draft, cards }: { message: ChatMessageView; draft: DocumentDraftDto | null; cards: CardProps }) {
  if (message.role === MessageRole.User) return <UserMessage content={message.content} />;
  return (
    <article className="motion-enter group">
      <MarkdownText className="text-message" text={message.content} />
      {draft !== null ? <DocumentDraftCard draft={draft} /> : null}
      <CardList results={message.results ?? []} messageId={message.id} cards={cards} />
      <div className="mt-1 -ml-2 flex items-center">
        <CopyAction text={message.content} />
        <ReadAloudAction text={message.content} />
      </div>
    </article>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <article className="motion-enter group flex flex-col items-end">
      <p className="max-w-bubble-max rounded-bubble bg-bubble px-4 py-2.5 text-base break-words whitespace-pre-wrap text-on-bubble">{content}</p>
      <div className="mt-1 flex opacity-100 transition-opacity group-hover:opacity-100 focus-within:opacity-100 md:opacity-0">
        <CopyAction text={content} />
      </div>
    </article>
  );
}

function LiveBubble({ turn, cards }: { turn: LiveTurn; cards: CardProps }) {
  const show = turn.phase !== StreamPhase.Idle || turn.pendingText.length > 0 || turn.pendingResults.length > 0;
  if (!show) return null;
  return (
    <div className="motion-enter" aria-live="polite">
      {turn.phase === StreamPhase.Searching ? <ShimmerText className="text-base">{SEARCHING_LABEL}</ShimmerText> : null}
      {turn.pendingText.length > 0 ? <MarkdownText className="text-message" text={turn.pendingText} /> : null}
      <CardList results={turn.pendingResults} messageId={null} cards={cards} />
    </div>
  );
}

function CardList({ results, messageId, cards }: { results: readonly VacancyResult[]; messageId: string | null; cards: CardProps }) {
  if (results.length === 0) return null;
  return (
    <div className="mt-3 space-y-3">
      {results.map((result, index) => (
        <div key={result.vacancy.id} className="motion-enter motion-stagger" style={{ '--stagger-index': index } as CSSProperties}>
          <VacancyCard
            result={result}
            open={cards.openIds.includes(result.vacancy.id)}
            onToggle={() => cards.onToggle(result.vacancy.id)}
            messageId={cards.account ? messageId : null}
          />
        </div>
      ))}
    </div>
  );
}
