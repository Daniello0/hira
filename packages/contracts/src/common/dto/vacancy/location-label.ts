/** Region of a city no Belarusian region is known for. It is storage, not a place to show. */
export const OTHER_CITIES_REGION = 'Другие города';

/** City and region as shown on a vacancy card. Empty and repeated pieces are dropped. */
export function formatLocationLabel(city: string | null, region: string | null): string | null {
  const place = clean(city);
  const area = region === OTHER_CITIES_REGION ? null : clean(region);
  const parts = [place, area === place ? null : area].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  return parts.join(', ');
}

function clean(value: string | null): string | null {
  if (value === null) return null;
  const text = value.trim();
  return text.length === 0 ? null : text;
}
