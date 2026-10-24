import { IntentType, MessageRole, type GenerateRequest, type PromptTurn, type VacancyResult } from '@hira/contracts';
import {
  CAREER_ADVICE_SYSTEM_PROMPT,
  DRAFT_SYSTEM_PROMPT,
  EMPTY_RESULTS_LINE,
  GENERATE_SYSTEM_PROMPT,
  LATEST_MESSAGE_LABEL,
  MAX_GENERATE_RESULTS,
  SMALL_TALK_SYSTEM_PROMPT,
} from '../llm/llm.constants';
import type { ChatMessage } from '../provider/chat-message';

/** Turns whose prompt carries the vacancy list. */
const SEARCHING = new Set([IntentType.Search, IntentType.Refine, IntentType.Compare]);

/**
 * Builds the prompt for the intent. Searches are grounded in the vacancy list; career advice,
 * small talk, and drafts get the user's own words instead. Vacancy descriptions and URLs stay out.
 * core-api sends the new replica as the last USER turn of `history`.
 */
export function buildGenerateMessages(request: GenerateRequest): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(request.intent.intentType) },
    { role: 'user', content: userContent(request) },
  ];
}

function systemPrompt(intentType: IntentType): string {
  if (intentType === IntentType.CareerAdvice) return CAREER_ADVICE_SYSTEM_PROMPT;
  if (intentType === IntentType.SmallTalk) return SMALL_TALK_SYSTEM_PROMPT;
  if (intentType === IntentType.DraftDocument) return DRAFT_SYSTEM_PROMPT;
  return GENERATE_SYSTEM_PROMPT;
}

function userContent(request: GenerateRequest): string {
  const { earlier, latest } = splitLatest(request.history);
  const searching = SEARCHING.has(request.intent.intentType);
  return [
    summaryLine(request.summary),
    documentLine(request.documents),
    historyLine(earlier),
    searching ? `Query: ${request.intent.rewrittenQuery}` : '',
    `${LATEST_MESSAGE_LABEL}: ${latest ?? request.intent.rewrittenQuery}`,
    searching ? resultsLine(request.results) : '',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

/** Separates the new replica from the earlier turns. Older callers that omit it fall back to the rewrite. */
function splitLatest(history: PromptTurn[]): { earlier: PromptTurn[]; latest: string | null } {
  const last = history[history.length - 1];
  if (last === undefined || last.role !== MessageRole.User) return { earlier: history, latest: null };
  return { earlier: history.slice(0, -1), latest: last.content };
}

function summaryLine(summary: GenerateRequest['summary']): string {
  if (summary === undefined || summary === null || summary.length === 0) return '';
  return `Chat summary: ${summary}`;
}

function documentLine(documents: GenerateRequest['documents']): string {
  if (documents === undefined || documents.length === 0) return '';
  return documents.map((document) => `File ${document.title}: ${document.content}`).join('\n');
}

function historyLine(history: PromptTurn[]): string {
  return history.map((turn) => `${turn.role}: ${turn.content}`).join('\n');
}

function resultsLine(results: VacancyResult[]): string {
  if (results.length === 0) return EMPTY_RESULTS_LINE;
  return results.slice(0, MAX_GENERATE_RESULTS).map(formatResult).join('\n');
}

function formatResult(result: VacancyResult): string {
  const matched = result.explanation.matchedSkills.map((skill) => skill.surface).join(', ');
  return `${result.vacancy.title} score ${result.score} matched ${matched}`;
}
