import type { ProfileSuggestionDto } from '@hira/contracts';
import { coreFetch } from '../../common/api/core-api';

/** Pending suggestions. A failure leaves the modal closed. */
export async function fetchSuggestions(token: string): Promise<ProfileSuggestionDto[] | null> {
  const response = await coreFetch('/api/v1/profile/suggestions', { method: 'GET' }, token);
  if (!response.ok) return null;
  return (await response.json()) as ProfileSuggestionDto[];
}

/** Accepts one suggestion into the profile. */
export async function acceptSuggestion(token: string, id: string): Promise<boolean> {
  const response = await coreFetch(`/api/v1/profile/suggestions/${id}/accept`, { method: 'POST' }, token);
  return response.ok;
}

/** Drops a suggestion without writing the profile. */
export async function dismissSuggestion(token: string, id: string): Promise<boolean> {
  const response = await coreFetch(`/api/v1/profile/suggestions/${id}/dismiss`, { method: 'POST' }, token);
  return response.ok;
}
