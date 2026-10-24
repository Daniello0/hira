import type { MemoryFactDto, MemorySettings, UpdateMemoryRequest } from '@hira/contracts';
import { authedFetch, readJson } from '../../common/api/authed-fetch';
import { jsonRequest } from '../../common/api/core-api';

/** Live facts, including ones Hira is not using while the switch is off. */
export async function fetchMemory(): Promise<MemoryFactDto[] | null> {
  return readJson<MemoryFactDto[]>(await authedFetch('/api/v1/memory'));
}

/** Edits the wording or the pin. */
export async function patchMemory(id: string, body: UpdateMemoryRequest): Promise<MemoryFactDto | null> {
  return readJson<MemoryFactDto>(await authedFetch(`/api/v1/memory/${id}`, jsonRequest('PATCH', body)));
}

/** Forgets one fact. */
export async function forgetMemory(id: string): Promise<boolean> {
  const response = await authedFetch(`/api/v1/memory/${id}`, { method: 'DELETE' });
  return response.ok;
}

/** Forgets every live fact. */
export async function forgetAllMemory(): Promise<boolean> {
  const response = await authedFetch('/api/v1/memory', { method: 'DELETE' });
  return response.ok;
}

/** Turns cross-chat memory on or off. Stored facts stay. */
export async function patchMemorySettings(body: MemorySettings): Promise<MemorySettings | null> {
  return readJson<MemorySettings>(await authedFetch('/api/v1/settings/memory', jsonRequest('PATCH', body)));
}
