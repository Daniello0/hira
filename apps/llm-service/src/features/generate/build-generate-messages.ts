import type { GenerateRequest, VacancyResult } from '@hira/contracts';
import {
  EMPTY_RESULTS_LINE,
  GENERATE_SYSTEM_PROMPT,
  MAX_GENERATE_RESULTS,
} from '../llm/llm.constants';
import type { ChatMessage } from '../provider/chat-message';

/** Builds a grounded prompt. Vacancy descriptions and URLs stay out of the model context. */
export function buildGenerateMessages(request: GenerateRequest): ChatMessage[] {
  return [
    { role: 'system', content: GENERATE_SYSTEM_PROMPT },
    { role: 'user', content: userContent(request) },
  ];
}

function userContent(request: GenerateRequest): string {
  return [summaryLine(request.summary), documentLine(request.documents), queryLine(request), historyLine(request), resultsLine(request)]
    .filter((line) => line.length > 0)
    .join('\n');
}

function summaryLine(summary: GenerateRequest['summary']): string {
  if (summary === undefined || summary === null || summary.length === 0) return '';
  return `Chat summary: ${summary}`;
}

function documentLine(documents: GenerateRequest['documents']): string {
  if (documents === undefined || documents.length === 0) return '';
  return documents.map((document) => `File ${document.title}: ${document.content}`).join('\n');
}

function queryLine(request: GenerateRequest): string {
  return `Query: ${request.intent.rewrittenQuery}`;
}

function historyLine(request: GenerateRequest): string {
  return request.history.map((turn) => `${turn.role}: ${turn.content}`).join('\n');
}

function resultsLine(request: GenerateRequest): string {
  if (request.results.length === 0) return EMPTY_RESULTS_LINE;
  return request.results.slice(0, MAX_GENERATE_RESULTS).map(formatResult).join('\n');
}

function formatResult(result: VacancyResult): string {
  const matched = result.explanation.matchedSkills.map((skill) => skill.surface).join(', ');
  return `${result.vacancy.title} score ${result.score} matched ${matched}`;
}
