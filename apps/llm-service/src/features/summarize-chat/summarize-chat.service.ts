import type { SummarizeChatRequest, SummarizeChatResponse } from '@hira/contracts';
import { completeJson, type StructuredDeps } from '../llm/complete-json';
import { buildSummaryJsonSchema, formatChatSummary, parseSummaryParts } from './summarize-chat.schema';

const SYSTEM_PROMPT =
  'Rewrite the chat summary into four short fields: goal, requirements, rejected options, and vacancies already discussed. Do not invent facts.';

/** Rewrites the rolling chat summary. The caller stores the joined text. */
export async function summarizeChat(
  deps: StructuredDeps,
  request: SummarizeChatRequest,
): Promise<SummarizeChatResponse> {
  const parts = await completeJson(deps, messages(request), buildSummaryJsonSchema(), parseSummaryParts);
  return { summary: formatChatSummary(parts) };
}

function messages(request: SummarizeChatRequest) {
  const previous = request.previousSummary ?? '';
  const history = request.messages.map((turn) => `${turn.role}: ${turn.content}`).join('\n');
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: `Previous summary:\n${previous}\n\nMessages:\n${history}` },
  ];
}
