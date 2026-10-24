import type { ExtractMemoryRequest, ExtractMemoryResponse } from '@hira/contracts';
import { completeJson, type StructuredDeps } from '../llm/complete-json';
import { MAX_TOKENS } from '../llm/llm.constants';
import { buildExtractMemoryJsonSchema, parseExtractMemoryModel } from './extract-memory.schema';

const SYSTEM_PROMPT =
  'Extract durable user facts and separate profile suggestions. confidence is 0 to 1. Use CONTRADICTS with targetMemoryId when a new fact replaces an old one. Do not include email addresses or user ids.';

/** Extracts facts and profile suggestions. Provenance is added by core-api. */
export async function extractMemory(
  deps: StructuredDeps,
  request: ExtractMemoryRequest,
): Promise<ExtractMemoryResponse> {
  return completeJson(deps, messages(request), buildExtractMemoryJsonSchema(), parseExtractMemoryModel, MAX_TOKENS.extractMemory);
}

function messages(request: ExtractMemoryRequest) {
  const existing = request.existingMemory.map((fact) => `${fact.id} ${fact.kind}: ${fact.content}`).join('\n');
  const recent = request.messages.map((turn) => `${turn.role}: ${turn.content}`).join('\n');
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: `Existing memory:\n${existing}\n\nExchange:\n${recent}` },
  ];
}
