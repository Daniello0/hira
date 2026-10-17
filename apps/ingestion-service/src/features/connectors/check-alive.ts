import { VacancySource } from '@hira/contracts';
import { isArchivedVacancy } from './archived-page';
import { assertRobots, detailTarget, readResponse, type CollectInput } from './collect-source';

export type AliveVerdict = 'open' | 'archived' | 'gone';

/** Reads one posting and says whether it is open, archived, or gone. */
export async function checkAlive(
  source: VacancySource,
  externalId: string,
  input: CollectInput,
): Promise<AliveVerdict> {
  const target = detailTarget(source, externalId);
  const response = await readResponse(input, `${target.origin}${target.path}`);
  return aliveVerdict(response.status, response.body);
}

/** Maps an HTTP response to a liveness verdict. Transport errors are thrown. */
export function aliveVerdict(status: number, body: string): AliveVerdict {
  if (isArchivedVacancy(body)) return 'archived';
  if (status === 404 || status === 410) return 'gone';
  if (status >= 400) throw new Error(`HTTP ${status}`);
  return 'open';
}

/** Refuses the run when robots.txt blocks a detail page of this source. */
export async function assertDetailsAllowed(
  source: VacancySource,
  input: CollectInput,
): Promise<void> {
  const target = detailTarget(source, '1');
  await assertRobots(input, target.origin, target.path);
}
