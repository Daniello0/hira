import {
  SkillImportance,
  SkillType,
  type ExtractedSkill,
  type ExtractedSkills,
  type ExtractSkillsRequest,
} from '@hira/contracts';
import { z } from 'zod';
import { enforceProviderSchema } from '../llm/provider-schema';

const requestSchema = z
  .object({
    vacancies: z
      .array(
        z
          .object({
            id: z.string().trim().min(1),
            title: z.string().trim().min(1),
            description: z.string().trim().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const modelSkillSchema = z
  .object({
    surface: z.string().min(1),
    skillType: stringEnum(Object.values(SkillType)),
    importance: stringEnum(Object.values(SkillImportance)),
    evidenceSpan: z.string().nullable(),
    weight: z.number().min(0).max(1),
  })
  .strict();

const modelSkillsSchema = z
  .object({
    skills: z.array(modelSkillSchema),
  })
  .strict();

const modelBatchSchema = z
  .object({
    results: z.array(
      z
        .object({
          id: z.string().min(1),
          skills: z.array(modelSkillSchema),
        })
        .strict(),
    ),
  })
  .strict();

/** Parses an extract-skills body. Throws `ZodError` when the list is empty or a field is blank. */
export function parseExtractSkillsRequest(value: unknown): ExtractSkillsRequest {
  return requestSchema.parse(value);
}

/** Parses one model payload. Throws when a skill breaks the enum or the weight bounds. */
export function parseModelSkills(value: unknown): { skills: ExtractedSkill[] } {
  return modelSkillsSchema.parse(value);
}

/** Parses a batch payload: one `{ id, skills }` per vacancy. */
export function parseModelSkillBatch(value: unknown): ExtractedSkills[] {
  return modelBatchSchema.parse(value).results;
}

/** JSON Schema sent to OpenRouter for one batch of vacancies. */
export function buildExtractSkillsJsonSchema(): Record<string, unknown> {
  return enforceProviderSchema(z.toJSONSchema(modelBatchSchema));
}

function stringEnum<T extends string>(values: readonly T[]) {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('enum has no values');
  return z.enum([first, ...rest]);
}
