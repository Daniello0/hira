import type { Pool } from 'pg';
import { withClient } from '../search/with-client';
import { findSimilar } from './find-similar';
import { loadSkillGap } from './skill-gap';
import type { VacancyPorts } from './vacancy.router';

/** Similar vacancies and skill gap bound to Postgres. */
export function openVacancy(pool: Pool): VacancyPorts {
  return {
    findSimilar: (vacancyId, limit) =>
      withClient(pool, (client) => findSimilar(client, vacancyId, limit)),
    skillGap: (vacancyId, userId) =>
      withClient(pool, (client) => loadSkillGap(client, vacancyId, userId)),
  };
}
