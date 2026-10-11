import { MessageRole, type UnderstandRequest } from '@hira/contracts';
import type { ChatMessage } from '../provider/chat-message';
import { UNDERSTAND_SYSTEM_PROMPT } from '../llm/llm.constants';

/** Builds the provider transcript for query understanding. The raw query is the last turn. */
export function buildUnderstandMessages(request: UnderstandRequest): ChatMessage[] {
  return [
    { role: 'system', content: UNDERSTAND_SYSTEM_PROMPT },
    ...memoryMessage(request),
    ...request.history.map(toMessage),
    { role: 'user', content: request.query },
  ];
}

function memoryMessage(request: UnderstandRequest): ChatMessage[] {
  if (request.memory.length === 0) return [];
  const content = request.memory.map((fact) => fact.content).join('\n');
  return [{ role: 'user', content }];
}

function toMessage(turn: UnderstandRequest['history'][number]): ChatMessage {
  return { role: chatRole(turn.role), content: turn.content };
}

function chatRole(role: MessageRole): ChatMessage['role'] {
  if (role === MessageRole.Assistant) return 'assistant';
  if (role === MessageRole.System) return 'system';
  return 'user';
}
