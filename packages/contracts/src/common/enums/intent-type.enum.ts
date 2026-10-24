/** Dialogue act of a user message. Values follow Wiki/02-retrieval-layer.md. */
export enum IntentType {
  Search = 'SEARCH',
  Refine = 'REFINE',
  Compare = 'COMPARE',
  CareerAdvice = 'CAREER_ADVICE',
  SmallTalk = 'SMALL_TALK',
  /** The user asks Hira to write or extend a md/txt file. The answer becomes a draft the user confirms (ADR-024). */
  DraftDocument = 'DRAFT_DOCUMENT',
}
