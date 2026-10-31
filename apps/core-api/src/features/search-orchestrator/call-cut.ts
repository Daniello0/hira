/**
 * A reply as the model should remember it. What was not heard was not said, but it stays
 * in view, so "go on" can continue from the very word where the user cut in.
 */
export function spokenContent(content: string, heardText: string | null | undefined): string {
  if (heardText === null || heardText === undefined || content.trim().length === 0) return content;
  const heard = heardText.trim().length === 0 ? 'nothing' : `only this: "${heardText.trim()}"`;
  return `[The user cut this reply off and heard ${heard}. The reply you had prepared: "${content}"]`;
}
