/** Lifecycle of one profile suggestion. Only pending rows are offered. */
export enum ProfileSuggestionStatus {
  Pending = 'PENDING',
  Accepted = 'ACCEPTED',
  Dismissed = 'DISMISSED',
}
