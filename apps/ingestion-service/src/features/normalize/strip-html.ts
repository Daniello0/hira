/** Drops tags and script bodies. The raw HTML stays on the vacancy separately. */
export function stripHtml(value: string): string {
  const withoutScripts = value.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ');
  return withoutTags.replace(/\s+/g, ' ').trim();
}
