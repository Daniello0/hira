import { LLM_UPSTREAM_STATUS, LLM_UPSTREAM_UNAVAILABLE_CODE, LLM_UPSTREAM_UNAVAILABLE_MESSAGE } from '../llm/llm.constants';
import { LlmRouteError } from '../llm/llm.errors';

/** A dead network becomes the upstream error, like a refusal. */
export async function reachable(call: () => Promise<Response>): Promise<Response> {
  try {
    return await call();
  } catch {
    throw upstreamError();
  }
}

export function upstreamError(): LlmRouteError {
  return new LlmRouteError(LLM_UPSTREAM_STATUS, LLM_UPSTREAM_UNAVAILABLE_CODE, LLM_UPSTREAM_UNAVAILABLE_MESSAGE);
}
