import type { FeedbackRating } from '@hira/contracts';
import { create } from 'zustand';
import { sendFeedback } from './vacancy-api';
import { FEEDBACK_FAILED } from './vacancy.constants';

interface FeedbackState {
  votes: Record<string, FeedbackRating>;
  errors: Record<string, string>;
  pending: Record<string, boolean>;
  vote: (messageId: string, vacancyId: string, rating: FeedbackRating) => Promise<void>;
}

type FeedbackSet = (partial: Partial<FeedbackState> | ((state: FeedbackState) => Partial<FeedbackState>)) => void;

/** Key of one vote: the same vacancy can be voted on in different answers. */
export function feedbackKey(messageId: string, vacancyId: string): string {
  return `${messageId}:${vacancyId}`;
}

/** Votes from this tab. The button flips at once and flips back if the server refuses. */
export const useFeedback = create<FeedbackState>((set, get) => ({
  votes: {},
  errors: {},
  pending: {},
  vote: (messageId, vacancyId, rating) => castVote(set, get, messageId, vacancyId, rating),
}));

/** One vote at a time per card. A second click while the first is in flight is ignored. */
async function castVote(
  set: FeedbackSet,
  get: () => FeedbackState,
  messageId: string,
  vacancyId: string,
  rating: FeedbackRating,
): Promise<void> {
  const key = feedbackKey(messageId, vacancyId);
  if (get().pending[key] === true) return;
  const previous = get().votes[key];
  set((state) => ({
    pending: { ...state.pending, [key]: true },
    votes: { ...state.votes, [key]: rating },
    errors: omit(state.errors, key),
  }));
  const saved = await sendFeedback({ messageId, vacancyId, rating }).catch(() => null);
  set((state) => settleVote(state, key, previous, saved !== null));
}

function settleVote(
  state: FeedbackState,
  key: string,
  previous: FeedbackRating | undefined,
  saved: boolean,
): Pick<FeedbackState, 'votes' | 'errors' | 'pending'> {
  const pending = { ...state.pending, [key]: false };
  if (saved) return { votes: state.votes, errors: state.errors, pending };
  return {
    votes: restore(state.votes, key, previous),
    errors: { ...state.errors, [key]: FEEDBACK_FAILED },
    pending,
  };
}

function restore(votes: Record<string, FeedbackRating>, key: string, previous: FeedbackRating | undefined): Record<string, FeedbackRating> {
  return previous === undefined ? omit(votes, key) : { ...votes, [key]: previous };
}

function omit<T>(map: Record<string, T>, key: string): Record<string, T> {
  const next = { ...map };
  delete next[key];
  return next;
}
