import type { ChatMessageView, VacancyResult } from '@hira/contracts';
import { MessageRole } from '@hira/contracts';
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
}

/** Dialogue column. Cards render as soon as results arrive. */
export function MessageList({ turn, openIds, onToggle, onOlder, hasOlder }: MessageListProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
      {hasOlder ? <button type="button" className="text-sm text-hira-muted" onClick={onOlder}>Older messages</button> : null}
      {turn.messages.map((message) => (
        <MessageBubble key={message.id} message={message} openIds={openIds} onToggle={onToggle} />
      ))}
      <LiveBubble turn={turn} openIds={openIds} onToggle={onToggle} />
    </div>
  );
}

function MessageBubble({ message, openIds, onToggle }: { message: ChatMessageView; openIds: readonly string[]; onToggle: (id: string) => void }) {
  const mine = message.role === MessageRole.User;
  return (
    <div className={mine ? 'ml-auto max-w-2xl' : 'max-w-3xl'}>
      <p className="whitespace-pre-wrap rounded-lg bg-hira-panel/70 px-3 py-2">{message.content}</p>
      <CardList results={message.results ?? []} openIds={openIds} onToggle={onToggle} />
    </div>
  );
}

function LiveBubble({ turn, openIds, onToggle }: { turn: LiveTurn; openIds: readonly string[]; onToggle: (id: string) => void }) {
  const show = turn.phase !== StreamPhase.Idle || turn.pendingText.length > 0 || turn.pendingResults.length > 0;
  if (!show) return null;
  return (
    <div className="max-w-3xl" aria-live="polite">
      {turn.phase === StreamPhase.Searching ? <p>{SEARCHING_LABEL}</p> : null}
      {turn.pendingText.length > 0 ? <p className="whitespace-pre-wrap">{turn.pendingText}</p> : null}
      <CardList results={turn.pendingResults} openIds={openIds} onToggle={onToggle} />
    </div>
  );
}

function CardList({ results, openIds, onToggle }: { results: readonly VacancyResult[]; openIds: readonly string[]; onToggle: (id: string) => void }) {
  return (
    <div className="mt-3 space-y-3">
      {results.map((result) => (
        <VacancyCard key={result.vacancy.id} result={result} open={openIds.includes(result.vacancy.id)} onToggle={() => onToggle(result.vacancy.id)} />
      ))}
    </div>
  );
}
