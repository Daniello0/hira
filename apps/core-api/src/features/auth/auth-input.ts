import type { RegisterRequest } from '@hira/contracts';

/** Trims and lowercases an email before it is stored or compared. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Trims a display name. Blank and non-strings become null at the service boundary. */
export function normalizeDisplayName(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Keeps non-strings so class-validator can reject them. Blank strings become omitted. */
export function normalizeDisplayNameInput(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/** Body field after the DTO transform. `displayName` is optional. */
export function displayNameFrom(input: RegisterRequest): string | null {
  return normalizeDisplayName(input.displayName);
}
