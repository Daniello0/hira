import { DuplicateDetection, VacancySource, VacancyStatus } from '@hira/contracts';
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

/** Confirms a cross-source copy. The cosine threshold 0.93 is not used here. */
export function crossSourceDecision(input: {
  incoming: CrossSourceSide;
  existing: CrossSourceExisting;
}): CrossSourceResult {
  if (!samePosting(input.incoming, input.existing)) return { duplicate: false };
  if (!descriptionsMatch(input.incoming.simhash, input.existing.simhash)) {
    return { duplicate: false };
  }
  return {
    duplicate: true,
    canonicalId: input.existing.id,
    detectedBy: DuplicateDetection.Fuzzy,
  };
}

function samePosting(incoming: CrossSourceSide, existing: CrossSourceExisting): boolean {
  if (existing.status !== VacancyStatus.Active) return false;
  if (existing.source === incoming.source) return false;
  if (existing.companyName !== incoming.companyName) return false;
  if (existing.city !== incoming.city) return false;
  return existing.title.trim().toLowerCase() === incoming.title.trim().toLowerCase();
}
