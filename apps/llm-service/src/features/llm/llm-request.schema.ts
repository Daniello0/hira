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
    knownVacancies: z.array(z.string()).optional(),
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
        includeForeignRemote: z.boolean().optional(),
      })
      .strict(),
    softConstraints: z.record(z.string(), z.number()),
    complexity: stringEnum(Object.values(QueryComplexity)),
    intentType: stringEnum(Object.values(IntentType)),
  })
  .strict();

const promptVacancySchema = z.object({
  title: z.string(),
  company: z.string(),
  city: z.string().nullable(),
  source: z.string().nullable(),
  workFormat: z.string().nullable(),
});

const countRow = (key: string) => z.object({ [key]: z.string(), count: z.number() });

/** Built by core-api, so unknown keys pass through; the prompt reads only what it knows. */
const factsSchema = z.object({
  catalog: z
    .object({
      total: z.number(),
      byRegion: z.array(countRow('region')),
      topCities: z.array(countRow('city')),
      noLocation: z.number(),
      remote: z.number(),
      foreignRemote: z.number(),
      bySource: z.array(countRow('source')),
    })
    .nullable(),
  profile: z
    .object({
      name: z.string().nullable(),
      headline: z.string().nullable(),
      about: z.string().nullable(),
      seniority: z.string().nullable(),
      desiredRoles: z.array(z.string()),
      workFormats: z.array(z.string()),
      salaryMin: z.number().nullable(),
      currency: z.string().nullable(),
      education: z.string().nullable(),
      skills: z.array(z.string()),
    })
    .nullable(),
  memory: z.array(memorySchema),
  favorites: z.array(promptVacancySchema),
  activity: z.array(
    z.object({
      kind: z.enum(['chat', 'call']),
      title: z.string().nullable(),
      summary: z.string().nullable(),
      queries: z.array(z.string()),
      vacancies: z.array(promptVacancySchema),
    }),
  ),
  shownHere: z.array(promptVacancySchema),
});

const generateRequestSchema = z
  .object({
    intent: intentSchema,
    history: z.array(turnSchema),
    results: z.array(resultSchema()),
    summary: z.string().nullable().optional(),
    documents: z.array(documentSchema).optional(),
    facts: factsSchema.optional(),
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
