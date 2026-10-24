import type { CreateProfileSkillRequest, ProfileDto, ProfileSkillDto, SkillSearchHitDto, UpdateProfileRequest } from '@hira/contracts';
import { coreFetch, jsonRequest } from '../../common/api/core-api';
import { readApiMessage } from '../auth/read-api-message';

const PROFILE_FAILED = 'Could not save the profile';

/** The seeker profile. */
export async function fetchProfile(token: string): Promise<ProfileDto | null> {
  const response = await coreFetch('/api/v1/profile', { method: 'GET' }, token);
  if (!response.ok) return null;
  return (await response.json()) as ProfileDto;
}

/** Writes the fields the form sent. */
export async function saveProfile(token: string, body: UpdateProfileRequest): Promise<string | null> {
  const response = await coreFetch('/api/v1/profile', jsonRequest('PUT', body), token);
  if (response.ok) return null;
  return readApiMessage(response, PROFILE_FAILED);
}

/** Skills already on the profile. */
export async function fetchProfileSkills(token: string): Promise<ProfileSkillDto[] | null> {
  const response = await coreFetch('/api/v1/profile/skills', { method: 'GET' }, token);
  if (!response.ok) return null;
  return (await response.json()) as ProfileSkillDto[];
}

/** Adds a catalog skill the user picked. */
export async function addProfileSkill(token: string, body: CreateProfileSkillRequest): Promise<string | null> {
  const response = await coreFetch('/api/v1/profile/skills', jsonRequest('POST', body), token);
  if (response.ok) return null;
  return readApiMessage(response, 'Could not add the skill');
}

/** Removes one profile skill. */
export async function removeProfileSkill(token: string, skillId: number): Promise<boolean> {
  const response = await coreFetch(`/api/v1/profile/skills/${skillId}`, { method: 'DELETE' }, token);
  return response.ok;
}

/** Catalog hits for the combobox. A short query is not sent. */
export async function searchSkills(token: string, query: string): Promise<SkillSearchHitDto[]> {
  const response = await coreFetch(`/api/v1/skills?q=${encodeURIComponent(query)}`, { method: 'GET' }, token);
  if (!response.ok) return [];
  return (await response.json()) as SkillSearchHitDto[];
}
