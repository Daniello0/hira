import type { TokenUsage } from '@hira/contracts';

/** A piece of a provider text stream. */
export type StreamEvent = { kind: 'delta'; text: string } | { kind: 'usage'; tokenUsage: TokenUsage };
