import type { MemoryFactDto, ProfileSkillDto } from '@hira/contracts';
import { coreFetch } from '../../common/api/core-api';

export interface AccountContext {
  skills: string[];
  facts: string[];
}

/** Profile names and memory wording for the chat panel. Demo does not call this. */
export async function loadAccountContext(token: string): Promise<AccountContext> {
  const [skillsResponse, memoryResponse] = await Promise.all([
    coreFetch('/api/v1/profile/skills', { method: 'GET' }, token),
    coreFetch('/api/v1/memory', { method: 'GET' }, token),
  ]);
  return { skills: await skillNames(skillsResponse), facts: await factLines(memoryResponse) };
}

async function skillNames(response: Response): Promise<string[]> {
  if (!response.ok) return [];
  const rows = (await response.json()) as ProfileSkillDto[];
  return rows.map((row) => row.canonicalName ?? '').filter((name) => name.length > 0);
}

async function factLines(response: Response): Promise<string[]> {
  if (!response.ok) return [];
  const rows = (await response.json()) as MemoryFactDto[];
  return rows.map((row) => row.content);
}
