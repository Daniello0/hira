'use client';

import type { ReactNode } from 'react';
import { FeedbackRating } from '@hira/contracts';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { feedbackKey, useFeedback } from './feedback.store';

/** Relevant / not relevant vote on a card inside an assistant answer. Account only. */
export function FeedbackButtons({ messageId, vacancyId }: { messageId: string; vacancyId: string }) {
  const key = feedbackKey(messageId, vacancyId);
  const current = useFeedback((state) => state.votes[key]);
  const error = useFeedback((state) => state.errors[key]);
  const pending = useFeedback((state) => state.pending[key] === true);
  const vote = useFeedback((state) => state.vote);
  return (
    <div className="flex items-center gap-2 text-sm">
      <VoteButton label="Relevant" active={current === FeedbackRating.Relevant} disabled={pending} onClick={() => void vote(messageId, vacancyId, FeedbackRating.Relevant)}>
        <ThumbsUp size={14} aria-hidden="true" />
      </VoteButton>
      <VoteButton label="Not relevant" active={current === FeedbackRating.Irrelevant} disabled={pending} onClick={() => void vote(messageId, vacancyId, FeedbackRating.Irrelevant)}>
        <ThumbsDown size={14} aria-hidden="true" />
      </VoteButton>
      {error !== undefined ? <span role="alert" className="text-xs">{error}</span> : null}
    </div>
  );
}

function VoteButton({ label, active, disabled, onClick, children }: { label: string; active: boolean; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      className={`rounded-md p-1 ${active ? 'bg-hira-accent text-white' : 'text-hira-muted hover:text-hira-text'}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
