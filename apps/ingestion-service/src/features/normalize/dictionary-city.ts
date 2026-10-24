/** English spellings LinkedIn and Indeed use for Belarusian cities, mapped to `locations`. */
const ENGLISH_CITIES: Record<string, string> = {
  minsk: 'Минск',
  brest: 'Брест',
  gomel: 'Гомель',
  homel: 'Гомель',
  grodno: 'Гродно',
  hrodna: 'Гродно',
  vitebsk: 'Витебск',
  viciebsk: 'Витебск',
  mogilev: 'Могилёв',
  mahilyow: 'Могилёв',
  mahilyou: 'Могилёв',
};

/** City name as stored in `locations`. A blank value is missing. */
export function dictionaryCity(city: string | null): string | null {
  if (city === null) return null;
  const name = city.replace(/^г\.\s*/i, '').trim();
  if (name.length === 0) return null;
  return ENGLISH_CITIES[name.toLowerCase()] ?? name;
}

/** True when the city is one of the Belarusian names above (either spelling). */
export function isBelarusCity(city: string | null): boolean {
  if (city === null) return false;
  const name = dictionaryCity(city);
  return name !== null && Object.values(ENGLISH_CITIES).includes(name);
}
