import { Language } from '@hira/contracts';
import { CYRILLIC_RU_SHARE } from '../ingestion.constants';

const LETTER = /\p{L}/gu;
const CYRILLIC = /\p{Script=Cyrillic}/gu;

/**
 * Russian when Cyrillic letters make up at least `CYRILLIC_RU_SHARE` of all letters,
 * English otherwise. A text without letters keeps the fallback.
 */
export function detectLanguage(text: string, fallback: Language = Language.Ru): Language {
  const letters = text.match(LETTER)?.length ?? 0;
  if (letters === 0) return fallback;
  const cyrillic = text.match(CYRILLIC)?.length ?? 0;
  return cyrillic / letters >= CYRILLIC_RU_SHARE ? Language.Ru : Language.En;
}
