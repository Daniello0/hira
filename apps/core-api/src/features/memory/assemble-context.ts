import type { PromptDocument, PromptMemory } from '@hira/contracts';
import { selectPromptDocuments, type PromptSourceDocument } from '../library/fit-documents';
import { selectPromptFacts } from './select-memory';
import type { MemoryFact } from './memory.types';

export interface AssembleInput {
  enabled: boolean;
  useMemory: boolean;
  summary: string | null;
  facts: readonly MemoryFact[];
  documents: readonly PromptSourceDocument[];
  queryVector: readonly number[] | null;
  now: Date;
}

export interface TurnContext {
  summary: string | null;
  memory: PromptMemory[];
  documents: PromptDocument[];
  extract: boolean;
}

/** Cross-chat facts follow the switch and the per-turn flag. Files do not. */
export function assembleTurnContext(input: AssembleInput): TurnContext {
  const extract = input.enabled && input.useMemory;
  const facts = extract ? input.facts : [];
  return {
    summary: input.summary,
    memory: selectPromptFacts(facts, input.queryVector, input.now),
    documents: selectPromptDocuments(input.documents),
    extract,
  };
}
