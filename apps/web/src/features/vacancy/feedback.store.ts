import type { FeedbackRating } from '@hira/contracts';
import { create } from 'zustand';
import { sendFeedback } from './vacancy-api';
import { FEEDBACK_FAILED } from './vacancy.constants';

interface FeedbackState {
  votes: Record<string, FeedbackRating>;
  errors: Record<string, string>;
  vote: (messageId: string, vacancyId: string, rating: FeedbackRating) => Promise<void>;
}

/** Key of one vote: the same vacancy can be voted on in different answers. */
export function feedbackKey(messageId: string, vacancyId: string): string {
  return `${messageId}:${vacancyId}`;
}

/** Votes from this tab. The button flips at once and flips back if the server refuses. */
export const useFeedback = create<FeedbackState>((set, get) => ({
  votes: {},
  errors: {},
  vote: async (messageId, vacancyId, rating) => {
    const key = feedbackKey(messageId, vacancyId);
    const previous = get().votes[key];
    set((state) => ({ votes: { ...state.votes, [key]: rating }, errors: omit(state.errors, key) }));
    const saved = await sendFeedback({ messageId, vacancyId, rating }).catch(() => null);
    if (saved !== null) return;
    set((state) => ({ votes: restore(state.votes, key, previous), errors: { ...state.errors, [key]: FEEDBACK_FAILED } }));
  },
}));

function restore(votes: Record<string, FeedbackRating>, key: string, previous: FeedbackRating | undefined): Record<string, FeedbackRating> {
  return previous === undefined ? omit(votes, key) : { ...votes, [key]: previous };
}

function omit<T>(map: Record<string, T>, key: string): Record<string, T> {
  const next = { ...map };
  delete next[key];
  return next;
}
