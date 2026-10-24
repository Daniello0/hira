import type { FusedHit } from '../fusion/rrf-fusion';
import type { LoadedVacancy } from '../search/load-vacancy';
import {
  personalShift,
  profileSignals,
  type PersonalContext,
  type ProfileSignals,
} from './profile-signals';

/** Reads S5 needs. `openSearch` binds them to Postgres. */
export interface PersonalPorts {
  loadVacancies(ids: readonly string[]): Promise<LoadedVacancy[]>;
  personalContext(userId: string, vacancyIds: readonly string[]): Promise<PersonalContext>;
}

/** Ranked hits after S5 and the profile signals of each hit (empty when S5 is off). */
export interface PersonalPage {
  hits: FusedHit[];
  signals: Map<string, ProfileSignals>;
}

/**
 * S5 personalization. Each hit keeps a position score (1 for the first, falling linearly)
 * that the profile shifts by at most ±15 %, then the list is re-sorted. No user → unchanged.
 */
export async function personalizePage(
  hits: readonly FusedHit[],
  userId: string | undefined,
  ports: PersonalPorts,
): Promise<PersonalPage> {
  if (userId === undefined || hits.length === 0) return { hits: [...hits], signals: new Map() };
  const ids = hits.map((hit) => hit.vacancyId);
  const [loaded, context] = await Promise.all([
    ports.loadVacancies(ids),
    ports.personalContext(userId, ids),
  ]);
  const signals = signalsOf(loaded, context);
  return { hits: reordered(hits, signals), signals };
}

function signalsOf(
  loaded: readonly LoadedVacancy[],
  context: PersonalContext,
): Map<string, ProfileSignals> {
  const signals = new Map<string, ProfileSignals>();
  for (const row of loaded) {
    const skills = context.vacancySkills.get(row.vacancy.id) ?? [];
    signals.set(row.vacancy.id, profileSignals(context.profile, row.vacancy, skills));
  }
  return signals;
}

function reordered(
  hits: readonly FusedHit[],
  signals: ReadonlyMap<string, ProfileSignals>,
): FusedHit[] {
  const count = hits.length;
  return hits
    .map((hit, index) => ({
      hit,
      index,
      score: ((count - index) / count) * (1 + shiftOf(signals, hit)),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.hit);
}

function shiftOf(signals: ReadonlyMap<string, ProfileSignals>, hit: FusedHit): number {
  const signal = signals.get(hit.vacancyId);
  return signal === undefined ? 0 : personalShift(signal);
}
