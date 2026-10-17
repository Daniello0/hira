import { DuplicateDetection, VacancySource, VacancyStatus } from '@hira/contracts';
import { DUPLICATE_COSINE_THRESHOLD } from '../ingestion.constants';
import { descriptionsMatch } from './simhash';

export interface CrossSourceSide {
  source: VacancySource;
  companyName: string;
  title: string;
  city: string | null;
  simhash: string;
}

export interface CrossSourceExisting extends CrossSourceSide {
  id: string;
  status: VacancyStatus;
}

export interface CrossSourceResult {
  duplicate: boolean;
  canonicalId?: string;
  detectedBy?: DuplicateDetection;
}

/** Confirms a cross-source copy by simhash, or by cosine when the hashes differ. */
export function crossSourceDecision(input: {
  incoming: CrossSourceSide;
  existing: CrossSourceExisting;
  cosine?: number | null;
}): CrossSourceResult {
  if (!samePosting(input.incoming, input.existing)) return { duplicate: false };
  if (descriptionsMatch(input.incoming.simhash, input.existing.simhash)) {
    return confirmed(input.existing.id, DuplicateDetection.Fuzzy);
  }
  if (input.cosine != null && input.cosine >= DUPLICATE_COSINE_THRESHOLD) {
    return confirmed(input.existing.id, DuplicateDetection.Embedding);
  }
  return { duplicate: false };
}

function confirmed(canonicalId: string, detectedBy: DuplicateDetection): CrossSourceResult {
  return { duplicate: true, canonicalId, detectedBy };
}

function samePosting(incoming: CrossSourceSide, existing: CrossSourceExisting): boolean {
  if (existing.status !== VacancyStatus.Active) return false;
  if (existing.source === incoming.source) return false;
  if (existing.companyName !== incoming.companyName) return false;
  if (!sameCity(existing.city, incoming.city)) return false;
  return existing.title.trim().toLowerCase() === incoming.title.trim().toLowerCase();
}

function sameCity(left: string | null, right: string | null): boolean {
  const known = knownCity(left);
  return known !== null && known === knownCity(right);
}

function knownCity(city: string | null): string | null {
  const name = city?.trim().toLowerCase() ?? '';
  return name.length === 0 ? null : name;
}
