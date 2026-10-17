/** City name as stored in `locations`. A blank value is missing. */
export function dictionaryCity(city: string | null): string | null {
  if (city === null) return null;
  const name = city.replace(/^г\.\s*/i, '').trim();
  return name.length === 0 ? null : name;
}
