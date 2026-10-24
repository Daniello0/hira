import type { ProfileSuggestionDto } from '@hira/contracts';
import { authedFetch, readJson } from '../../common/api/authed-fetch';

/** Pending suggestions. A failure leaves the modal closed. */
export async function fetchSuggestions(): Promise<ProfileSuggestionDto[] | null> {
  return readJson<ProfileSuggestionDto[]>(await authedFetch('/api/v1/profile/suggestions'));
}

/** Accepts one suggestion into the profile. */
export async function acceptSuggestion(id: string): Promise<boolean> {
  const response = await authedFetch(`/api/v1/profile/suggestions/${id}/accept`, { method: 'POST' });
  return response.ok;
}

/** Drops a suggestion without writing the profile. */
export async function dismissSuggestion(id: string): Promise<boolean> {
  const response = await authedFetch(`/api/v1/profile/suggestions/${id}/dismiss`, { method: 'POST' });
  return response.ok;
}
