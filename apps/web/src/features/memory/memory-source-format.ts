import type { MemoryFactDto } from '@hira/contracts';

export interface MemorySourcePresentation {
  href: string | null;
  label: string;
}

/** Chat links when resolvable; a call is named by the date the fact was stored, since calls have no page. */
export function formatMemorySource(fact: MemoryFactDto): MemorySourcePresentation {
  if (fact.sourceChatId !== null && fact.sourceMessageId !== null) {
    return { href: `/chat/${fact.sourceChatId}`, label: 'Open source chat' };
  }
  if (fact.sourceCallSessionId !== null && fact.sourceCallTurnId !== null) {
    return { href: null, label: `Call · ${callDate(fact.createdAt)}` };
  }
  if (fact.sourceMessageId !== null) {
    return { href: null, label: 'Chat message (chat deleted)' };
  }
  if (fact.sourceCallTurnId !== null) {
    return { href: null, label: `Call · ${callDate(fact.createdAt)}` };
  }
  return { href: null, label: 'No source recorded' };
}

function callDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'date unknown';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
