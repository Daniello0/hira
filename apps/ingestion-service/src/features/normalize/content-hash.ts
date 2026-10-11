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
