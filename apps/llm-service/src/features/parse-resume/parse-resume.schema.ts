import { SkillLevel, type ParseResumeRequest, type ParsedResumeExperience, type ParsedResumeSkill } from '@hira/contracts';
import { z } from 'zod';
import { enforceProviderSchema } from '../llm/provider-schema';

const skillSchema = z
  .object({
    surface: z.string().min(1),
    level: stringEnum(Object.values(SkillLevel)).nullable(),
    years: z.number().nullable(),
  })
  .strict();

const modelSchema = z
  .object({
    skills: z.array(skillSchema),
    experience: z.array(z.object({ text: z.string().min(1) }).strict()),
  })
  .strict();

const requestSchema = z.object({ resumeText: z.string().trim().min(1) }).strict();

/** Parses a parse-resume body. */
export function parseParseResumeRequest(value: unknown): ParseResumeRequest {
  return requestSchema.parse(value);
}

/** Parses a resume model payload. */
export function parseResumeModel(value: unknown): { skills: ParsedResumeSkill[]; experience: ParsedResumeExperience[] } {
  return modelSchema.parse(value);
}

/** JSON Schema sent to OpenRouter for resume parsing. */
export function buildParseResumeJsonSchema(): Record<string, unknown> {
  return enforceProviderSchema(z.toJSONSchema(modelSchema));
}

function stringEnum<T extends string>(values: readonly T[]) {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('enum has no values');
  return z.enum([first, ...rest]);
}
