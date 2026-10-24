import type { ChatMessageView, DocumentDraftDto, VacancyResult } from '@hira/contracts';
import { MessageRole } from '@hira/contracts';
import { useEffect, useRef } from 'react';
import { MarkdownText } from '../../common/components/markdown-text';
import { DocumentDraftCard } from '../document-draft/document-draft-card';
import { SEARCHING_LABEL } from './chat.constants';
import type { LiveTurn } from './reduce-chat-event';
import { StreamPhase } from './stream-phase';
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
  const bottom = useBottomAnchor(turn);
  const cards = { openIds, onToggle, account };
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
      {hasOlder ? <button type="button" className="text-sm text-hira-muted" onClick={onOlder}>Older messages</button> : null}
      {turn.messages.map((message) => (
        <MessageBubble key={message.id} message={message} draft={turn.drafts[message.id] ?? null} cards={cards} />
      ))}
      <LiveBubble turn={turn} cards={cards} />
      <div ref={bottom} />
    </div>
  );
}

/** Scrolls to the newest message and to streaming text, but not when older pages are prepended. */
function useBottomAnchor(turn: LiveTurn) {
  const anchor = useRef<HTMLDivElement>(null);
  const lastId = turn.messages.at(-1)?.id ?? '';
  useEffect(() => {
    anchor.current?.scrollIntoView({ block: 'end' });
  }, [lastId, turn.pendingText, turn.pendingResults.length, turn.phase]);
  return anchor;
}

function MessageBubble({ message, draft, cards }: { message: ChatMessageView; draft: DocumentDraftDto | null; cards: CardProps }) {
  const mine = message.role === MessageRole.User;
  return (
    <div className={mine ? 'ml-auto max-w-2xl' : 'max-w-3xl'}>
      <div className="rounded-lg bg-hira-panel/70 px-3 py-2">
        {mine ? <p className="whitespace-pre-wrap">{message.content}</p> : <MarkdownText text={message.content} />}
      </div>
      {draft !== null ? <DocumentDraftCard draft={draft} /> : null}
      <CardList results={message.results ?? []} messageId={mine ? null : message.id} cards={cards} />
    </div>
  );
}

function LiveBubble({ turn, cards }: { turn: LiveTurn; cards: CardProps }) {
  const show = turn.phase !== StreamPhase.Idle || turn.pendingText.length > 0 || turn.pendingResults.length > 0;
  if (!show) return null;
  return (
    <div className="max-w-3xl" aria-live="polite">
      {turn.phase === StreamPhase.Searching ? <p>{SEARCHING_LABEL}</p> : null}
      {turn.pendingText.length > 0 ? <MarkdownText text={turn.pendingText} /> : null}
      <CardList results={turn.pendingResults} messageId={null} cards={cards} />
    </div>
  );
}

function CardList({ results, messageId, cards }: { results: readonly VacancyResult[]; messageId: string | null; cards: CardProps }) {
  return (
    <div className="mt-3 space-y-3">
      {results.map((result) => (
        <VacancyCard
          key={result.vacancy.id}
          result={result}
          open={cards.openIds.includes(result.vacancy.id)}
          onToggle={() => cards.onToggle(result.vacancy.id)}
          messageId={cards.account ? messageId : null}
        />
      ))}
    </div>
  );
}
