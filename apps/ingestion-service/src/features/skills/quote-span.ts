/** Keeps a quote only when the description actually contains it. */
export function quoteFromDescription(description: string, span: string | null): string | null {
  if (span === null) return null;
  const quote = span.trim();
  if (quote.length === 0) return null;
  return description.includes(quote) ? quote : null;
}
