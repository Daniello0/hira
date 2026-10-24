import type { CreateProfileSkillRequest, LocationDto, ProfileDto, ProfileSkillDto, SkillSearchHitDto, UpdateProfileRequest } from '@hira/contracts';
import { authedFetch, readJson } from '../../common/api/authed-fetch';
import { jsonRequest } from '../../common/api/core-api';
import { readApiMessage } from '../auth/read-api-message';

const PROFILE_FAILED = 'Could not save the profile';

/** The seeker profile. */
export async function fetchProfile(): Promise<ProfileDto | null> {
  return readJson<ProfileDto>(await authedFetch('/api/v1/profile'));
}

/** Writes the fields the request names. Omitted fields stay as stored. */
export async function saveProfile(body: UpdateProfileRequest): Promise<string | null> {
  const response = await authedFetch('/api/v1/profile', jsonRequest('PUT', body));
  if (response.ok) return null;
  return readApiMessage(response, PROFILE_FAILED);
}

/** Skills already on the profile. */
export async function fetchProfileSkills(): Promise<ProfileSkillDto[] | null> {
  return readJson<ProfileSkillDto[]>(await authedFetch('/api/v1/profile/skills'));
}

/** Adds a catalog skill the user picked. */
export async function addProfileSkill(body: CreateProfileSkillRequest): Promise<string | null> {
  const response = await authedFetch('/api/v1/profile/skills', jsonRequest('POST', body));
  if (response.ok) return null;
  return readApiMessage(response, 'Could not add the skill');
}

/** Removes one profile skill. */
export async function removeProfileSkill(skillId: number): Promise<boolean> {
  const response = await authedFetch(`/api/v1/profile/skills/${skillId}`, { method: 'DELETE' });
  return response.ok;
}

/** Catalog hits for the combobox. `null` when the request failed. */
export async function searchSkills(query: string): Promise<SkillSearchHitDto[] | null> {
  return readJson<SkillSearchHitDto[]>(await authedFetch(`/api/v1/skills?q=${encodeURIComponent(query)}`));
}

/** Cities for the profile picker. An empty query returns the first page. `null` when it failed. */
export async function searchLocations(query: string): Promise<LocationDto[] | null> {
  const suffix = query.trim().length === 0 ? '' : `?q=${encodeURIComponent(query.trim())}`;
  return readJson<LocationDto[]>(await authedFetch(`/api/v1/locations${suffix}`));
}
