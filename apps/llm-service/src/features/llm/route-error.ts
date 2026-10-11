import { ZodError } from 'zod';
import {
  LLM_INVALID_OUTPUT_CODE,
  LLM_INVALID_OUTPUT_MESSAGE,
  LLM_INVALID_OUTPUT_STATUS,
  LLM_UPSTREAM_STATUS,
  LLM_UPSTREAM_UNAVAILABLE_CODE,
  LLM_UPSTREAM_UNAVAILABLE_MESSAGE,
  VALIDATION_FAILED_CODE,
  VALIDATION_FAILED_MESSAGE,
  VALIDATION_FAILED_STATUS,
} from './llm.constants';
import { LlmOutputError, LlmRouteError, ProviderTransportError } from './llm.errors';

/** Maps a known LLM failure onto the shared error body. Unknown errors stay thrown. */
export function toRouteError(error: unknown): LlmRouteError | null {
  if (error instanceof LlmRouteError) return error;
  if (error instanceof ZodError) return validationError(error);
  if (error instanceof LlmOutputError) return invalidOutputError();
  if (error instanceof ProviderTransportError) return upstreamError();
  return null;
}

function validationError(error: ZodError): LlmRouteError {
  return new LlmRouteError(
    VALIDATION_FAILED_STATUS,
    VALIDATION_FAILED_CODE,
    VALIDATION_FAILED_MESSAGE,
    error.issues,
  );
}

function invalidOutputError(): LlmRouteError {
  return new LlmRouteError(
    LLM_INVALID_OUTPUT_STATUS,
    LLM_INVALID_OUTPUT_CODE,
    LLM_INVALID_OUTPUT_MESSAGE,
  );
}

function upstreamError(): LlmRouteError {
  return new LlmRouteError(
    LLM_UPSTREAM_STATUS,
    LLM_UPSTREAM_UNAVAILABLE_CODE,
    LLM_UPSTREAM_UNAVAILABLE_MESSAGE,
  );
}
