/** Screen state of one call. Speech stays in the browser. */
export enum CallPhase {
  Idle = 'idle',
  Listening = 'listening',
  Thinking = 'thinking',
  Speaking = 'speaking',
}
