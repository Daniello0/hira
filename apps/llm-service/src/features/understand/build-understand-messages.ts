import { MessageRole, type UnderstandRequest } from '@hira/contracts';
import type { ChatMessage } from '../provider/chat-message';
import { UNDERSTAND_SYSTEM_PROMPT } from '../llm/llm.constants';

/** Builds the provider transcript for query understanding. The raw query is the last turn. */
export function buildUnderstandMessages(request: UnderstandRequest): ChatMessage[] {
  return [
    { role: 'system', content: UNDERSTAND_SYSTEM_PROMPT },
    ...note('Chat summary', request.summary),
    ...documentMessage(request.documents),
    ...memoryMessage(request),
    ...note('Vacancies the user may refer to', request.knownVacancies?.join('\n')),
    ...request.history.map(toMessage),
    { role: 'user', content: request.query },
  ];
}

function note(label: string, text: string | null | undefined): ChatMessage[] {
  if (text === undefined || text === null || text.length === 0) return [];
  return [{ role: 'user', content: `${label}:\n${text}` }];
}

function documentMessage(documents: UnderstandRequest['documents']): ChatMessage[] {
  if (documents === undefined || documents.length === 0) return [];
  const body = documents.map((document) => `${document.title} (${document.kind})\n${document.content}`).join('\n\n');
  return [{ role: 'user', content: `Library:\n${body}` }];
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
