import { z } from 'zod';
import type { SummarizeChatRequest } from '@hira/contracts';
import { MessageRole } from '@hira/contracts';
import { enforceProviderSchema } from '../llm/provider-schema';

const requestSchema = z
  .object({
    previousSummary: z.string().nullable(),
    messages: z.array(
      z
        .object({
          role: z.enum([MessageRole.User, MessageRole.Assistant]),
          content: z.string().trim().min(1),
        })
        .strict(),
    ),
  })
  .strict();

const partsSchema = z
  .object({
    goal: z.string(),
    requirements: z.string(),
    rejected: z.string(),
    vacancies: z.string(),
  })
  .strict();

export interface SummaryParts {
  goal: string;
  requirements: string;
  rejected: string;
  vacancies: string;
}

/** Joins the four fixed blocks from Wiki/07 §3.2. */
export function formatChatSummary(parts: SummaryParts): string {
  return [
    `Цель поиска: ${parts.goal}`,
    `Уточнённые требования: ${parts.requirements}`,
    `Отвергнутые варианты и почему: ${parts.rejected}`,
    `Обсуждённые вакансии: ${parts.vacancies}`,
  ].join('\n');
}

/** Parses a summarize-chat body. */
export function parseSummarizeRequest(value: unknown): SummarizeChatRequest {
  return requestSchema.parse(value);
}

/** Parses the model payload for a chat summary. */
export function parseSummaryParts(value: unknown): SummaryParts {
  return partsSchema.parse(value);
}

/** JSON Schema sent to OpenRouter for the summary. */
export function buildSummaryJsonSchema(): Record<string, unknown> {
  return enforceProviderSchema(z.toJSONSchema(partsSchema));
}
