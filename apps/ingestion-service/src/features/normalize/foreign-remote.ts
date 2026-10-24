import { WorkFormat } from '@hira/contracts';
import { BELARUS_COUNTRY_CODE } from '../ingestion.constants';
import { isBelarusCity } from './dictionary-city';

const BELARUS_NAMES = new Set([BELARUS_COUNTRY_CODE.toLowerCase(), 'belarus', 'беларусь', 'blr']);

export interface ForeignRemoteInput {
  workFormat: WorkFormat | null;
  country: string | null | undefined;
  city: string | null;
  remoteWorldwide: boolean | undefined;
}

/**
 * Wiki/03 §1.8: a remote vacancy located outside Belarus. A posting from a remote-worldwide
 * query with no country is foreign too, unless its city is Belarusian.
 */
export function isForeignRemote(input: ForeignRemoteInput): boolean {
  if (input.workFormat !== WorkFormat.Remote) return false;
  const country = input.country?.trim().toLowerCase() ?? '';
  if (country.length > 0) return !BELARUS_NAMES.has(country);
  return input.remoteWorldwide === true && !isBelarusCity(input.city);
}
