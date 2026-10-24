import type { MemoryFactDto, ProfileDto, ProfileSkillDto } from '@hira/contracts';
import { authedFetch, readJson } from '../../common/api/authed-fetch';

export interface AccountContext {
  skills: string[];
  facts: string[];
  seniority: ProfileDto['seniority'];
}

/** Empty panel before the account data arrives. */
export const EMPTY_ACCOUNT_CONTEXT: AccountContext = { skills: [], facts: [], seniority: null };

/** Profile names, seniority, and memory wording for the chat panel. Demo does not call this. */
export async function loadAccountContext(): Promise<AccountContext> {
  const [skills, facts, profile] = await Promise.all([
    authedFetch('/api/v1/profile/skills').then((response) => readJson<ProfileSkillDto[]>(response)),
    authedFetch('/api/v1/memory').then((response) => readJson<MemoryFactDto[]>(response)),
    authedFetch('/api/v1/profile').then((response) => readJson<ProfileDto>(response)),
  ]);
  return {
    skills: (skills ?? []).map((row) => row.canonicalName ?? '').filter((name) => name.length > 0),
    facts: (facts ?? []).map((row) => row.content),
    seniority: profile?.seniority ?? null,
  };
}
