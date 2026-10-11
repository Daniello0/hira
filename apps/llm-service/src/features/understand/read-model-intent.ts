import type { SearchIntent } from '@hira/contracts';
import { ZodError } from 'zod';
import { LlmOutputError } from '../llm/llm.errors';
import { mapSearchIntent } from './map-search-intent';
import { parseModelIntent } from './search-intent.schema';

/** Parses model text into a `SearchIntent`, or throws `LlmOutputError`. */
export function readModelIntent(content: string): SearchIntent {
  const model = parseModelIntent(parseJson(content));
  return mapSearchIntent(model);
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new LlmOutputError('response is not json');
  }
}

/** Wraps schema failures so the retry loop can quote them. Exported for the service. */
export function asModelOutput(content: string): SearchIntent {
  try {
    return readModelIntent(content);
  } catch (error) {
    if (error instanceof LlmOutputError) throw error;
    throw new LlmOutputError(issueText(error));
  }
}

function issueText(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  }
  if (error instanceof Error) return error.message;
  return 'invalid model output';
}
