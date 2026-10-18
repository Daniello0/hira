import {
  EmploymentType,
  IntentType,
  MessageRole,
  QueryComplexity,
  RetrievalBranch,
  SeniorityLevel,
  WorkFormat,
  type GenerateRequest,
  type UnderstandRequest,
} from '@hira/contracts';
import { DocumentKind } from '@hira/contracts';
import { z } from 'zod';

const turnSchema = z
  .object({
    role: z.enum([MessageRole.User, MessageRole.Assistant]),
    content: z.string().trim().min(1),
  })
  .strict();

const memorySchema = z
  .object({
    content: z.string().trim().min(1),
  })
  .strict();

const documentSchema = z
  .object({
    title: z.string().min(1),
    kind: stringEnum(Object.values(DocumentKind)),
    content: z.string(),
  })
  .strict();

const understandRequestSchema = z
  .object({
    query: z.string().trim().min(1),
    history: z.array(turnSchema),
    memory: z.array(memorySchema),
    summary: z.string().nullable().optional(),
    documents: z.array(documentSchema).optional(),
  })
  .strict();

const skillSchema = z
  .object({
    surface: z.string().min(1),
    canonicalId: z.string().nullable(),
    required: z.boolean(),
  })
  .strict();

const intentSchema = z
  .object({
    rewrittenQuery: z.string().min(1),
    role: z.string().min(1).nullable(),
    skills: z.array(skillSchema),
    seniority: stringEnum(Object.values(SeniorityLevel)).nullable(),
    hardConstraints: z
      .object({
        workFormat: z.array(stringEnum(Object.values(WorkFormat))).optional(),
        employment: z.array(stringEnum(Object.values(EmploymentType))).optional(),
        location: z.array(z.string()).optional(),
        salaryMin: z.number().optional(),
      })
      .strict(),
    softConstraints: z.record(z.string(), z.number()),
    complexity: stringEnum(Object.values(QueryComplexity)),
    intentType: stringEnum(Object.values(IntentType)),
  })
  .strict();

const generateRequestSchema = z
  .object({
    intent: intentSchema,
    history: z.array(turnSchema),
    results: z.array(resultSchema()),
    summary: z.string().nullable().optional(),
    documents: z.array(documentSchema).optional(),
  })
  .strict();

/** Parses an understand body. Throws `ZodError` when the payload is unusable. */
export function parseUnderstandRequest(value: unknown): UnderstandRequest {
  return understandRequestSchema.parse(value);
}

/** Parses a generate body. Throws `ZodError` when the payload is unusable. */
export function parseGenerateRequest(value: unknown): GenerateRequest {
  return generateRequestSchema.parse(value) as unknown as GenerateRequest;
}

function resultSchema() {
  return z
    .object({
      vacancy: z
        .object({
          title: z.string().min(1),
          description: z.string(),
        })
        .passthrough(),
      score: z.number(),
      explanation: z.object({}).passthrough(),
      retrievedBy: z.array(stringEnum(Object.values(RetrievalBranch))),
    })
    .passthrough();
}

function stringEnum<T extends string>(values: readonly T[]) {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('enum has no values');
  return z.enum([first, ...rest]);
}
