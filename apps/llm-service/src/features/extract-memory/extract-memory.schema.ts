import {
  EmploymentType,
  MemoryKind,
  MemoryOperation,
  MessageRole,
  ProfileSuggestionKind,
  SkillLevel,
  WorkFormat,
  type ExtractedSuggestion,
  type ExtractMemoryRequest,
  type MemoryCandidate,
} from '@hira/contracts';
import { z } from 'zod';
import { enforceProviderSchema } from '../llm/provider-schema';

const candidateSchema = z
  .object({
    kind: stringEnum(Object.values(MemoryKind)),
    content: z.string().min(1),
    confidence: z.number(),
    operation: stringEnum(Object.values(MemoryOperation)),
    targetMemoryId: z.string().nullable(),
  })
  .strict();

const suggestionSchema = z
  .object({
    kind: stringEnum(Object.values(ProfileSuggestionKind)),
    surface: z.string().nullable(),
    level: stringEnum(Object.values(SkillLevel)).nullable(),
    years: z.number().nullable(),
    workFormat: stringEnum(Object.values(WorkFormat)).nullable(),
    employment: stringEnum(Object.values(EmploymentType)).nullable(),
    salaryMin: z.number().nullable(),
    currency: z.string().nullable(),
    city: z.string().nullable(),
    role: z.string().nullable(),
    education: z.string().nullable(),
  })
  .strict();

const modelSchema = z
  .object({
    candidates: z.array(candidateSchema),
    suggestions: z.array(suggestionSchema),
  })
  .strict();

const requestSchema = z
  .object({
    messages: z.array(
      z
        .object({
          role: z.enum([MessageRole.User, MessageRole.Assistant]),
          content: z.string().trim().min(1),
        })
        .strict(),
    ),
    existingMemory: z.array(
      z
        .object({
          id: z.string().uuid(),
          kind: stringEnum(Object.values(MemoryKind)),
          content: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

/** Parses an extract-memory body. */
export function parseExtractMemoryRequest(value: unknown): ExtractMemoryRequest {
  return requestSchema.parse(value);
}

/** Parses extract-memory model output into candidates and profile suggestions. */
export function parseExtractMemoryModel(value: unknown): { candidates: MemoryCandidate[]; suggestions: ExtractedSuggestion[] } {
  const parsed = modelSchema.parse(value);
  return {
    candidates: parsed.candidates.map(toCandidate),
    suggestions: parsed.suggestions,
  };
}

/** JSON Schema sent to OpenRouter for memory extraction. */
export function buildExtractMemoryJsonSchema(): Record<string, unknown> {
  return enforceProviderSchema(z.toJSONSchema(modelSchema));
}

function toCandidate(row: z.infer<typeof candidateSchema>): MemoryCandidate {
  return {
    kind: row.kind,
    content: row.content,
    confidence: row.confidence,
    operation: row.operation,
    ...(row.targetMemoryId === null ? {} : { targetMemoryId: row.targetMemoryId }),
  };
}

function stringEnum<T extends string>(values: readonly T[]) {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('enum has no values');
  return z.enum([first, ...rest]);
}
