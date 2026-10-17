import { createHash } from 'node:crypto';

export interface HashInput {
  title: string;
  description: string;
  skillsText: string;
  conditions: string;
}

/** SHA-256 of the normalized text that should invalidate an embedding. */
export function contentHash(input: HashInput): string {
  const payload = [input.title, input.description, input.skillsText, input.conditions].join('\n');
  return createHash('sha256').update(payload).digest('hex');
}

/** Hash of the source text. Skill names are not part of it. */
export function sourceHash(input: {
  title: string;
  description: string;
  conditions: string;
}): string {
  return contentHash({ ...input, skillsText: '' });
}

/** Work format and schedule, the conditions half of the content hash. */
export function conditionsText(workFormat: string | null, schedule: string | null): string {
  return `${workFormat ?? ''}|${schedule ?? ''}`;
}
