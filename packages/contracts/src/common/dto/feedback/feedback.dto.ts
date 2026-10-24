import type { FeedbackRating } from '../../enums/feedback-rating.enum';

/** Body of `POST /api/v1/feedback`: a vote on a vacancy shown in an assistant message. */
export interface CreateFeedbackRequest {
  messageId: string;
  vacancyId: string;
  rating: FeedbackRating;
  comment?: string | null;
}

/** Stored vote. A repeated vote on the same pair replaces the previous one. */
export interface FeedbackDto {
  id: string;
  messageId: string;
  vacancyId: string;
  rating: FeedbackRating;
  comment: string | null;
  createdAt: string;
}
