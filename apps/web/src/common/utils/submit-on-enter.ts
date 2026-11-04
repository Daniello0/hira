import type { KeyboardEvent } from 'react';

/** Enter sends the text; Shift+Enter and an unfinished IME word keep typing. */
export function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>, onSend: () => void): void {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
  event.preventDefault();
  onSend();
}
