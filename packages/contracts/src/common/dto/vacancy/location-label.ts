/** City and region as shown on a vacancy card. Empty pieces are dropped. */
export function formatLocationLabel(city: string | null, region: string | null): string | null {
  const parts = [clean(city), clean(region)].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  return parts.join(', ');
}

function clean(value: string | null): string | null {
  if (value === null) return null;
  const text = value.trim();
  return text.length === 0 ? null : text;
}
