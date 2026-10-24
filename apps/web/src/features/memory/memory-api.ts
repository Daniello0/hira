import type { MemoryFactDto, MemorySettings, UpdateMemoryRequest } from '@hira/contracts';
import { coreFetch, jsonRequest } from '../../common/api/core-api';

/** Live facts, including ones Hira is not using while the switch is off. */
export async function fetchMemory(token: string): Promise<MemoryFactDto[] | null> {
  const response = await coreFetch('/api/v1/memory', { method: 'GET' }, token);
  if (!response.ok) return null;
  return (await response.json()) as MemoryFactDto[];
}

/** Edits the wording or the pin. */
export async function patchMemory(token: string, id: string, body: UpdateMemoryRequest): Promise<MemoryFactDto | null> {
  const response = await coreFetch(`/api/v1/memory/${id}`, jsonRequest('PATCH', body), token);
  if (!response.ok) return null;
  return (await response.json()) as MemoryFactDto;
}

/** Forgets one fact. */
export async function forgetMemory(token: string, id: string): Promise<boolean> {
  const response = await coreFetch(`/api/v1/memory/${id}`, { method: 'DELETE' }, token);
  return response.ok;
}

/** Forgets every live fact. */
export async function forgetAllMemory(token: string): Promise<boolean> {
  const response = await coreFetch('/api/v1/memory', { method: 'DELETE' }, token);
  return response.ok;
}

/** Turns cross-chat memory on or off. Stored facts stay. */
export async function patchMemorySettings(token: string, body: MemorySettings): Promise<MemorySettings | null> {
  const response = await coreFetch('/api/v1/settings/memory', jsonRequest('PATCH', body), token);
  if (!response.ok) return null;
  return (await response.json()) as MemorySettings;
}
