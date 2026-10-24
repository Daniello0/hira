import type { MemoryFactDto } from '@hira/contracts';

export interface MemorySourcePresentation {
  href: string | null;
  label: string;
}

/** Chat links when resolvable; call provenance stays text until deep routes exist. */
export function formatMemorySource(fact: MemoryFactDto): MemorySourcePresentation {
  if (fact.sourceChatId !== null && fact.sourceMessageId !== null) {
    return { href: `/chat/${fact.sourceChatId}`, label: 'Open source chat' };
  }
  if (fact.sourceCallSessionId !== null && fact.sourceCallTurnId !== null) {
    return { href: null, label: `Call session ${fact.sourceCallSessionId}` };
  }
  if (fact.sourceMessageId !== null) {
    return { href: null, label: `Message ${fact.sourceMessageId} (chat unavailable)` };
  }
  if (fact.sourceCallTurnId !== null) {
    return { href: null, label: `Call turn ${fact.sourceCallTurnId}` };
  }
  return { href: null, label: 'No source recorded' };
}
