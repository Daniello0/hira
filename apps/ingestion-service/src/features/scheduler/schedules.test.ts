import { VacancySource } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { JOB_INCREMENTAL, JOB_LIVENESS, QUEUE_PREFIX } from '../ingestion.constants';
import { bullQueueName, ingestionSchedules, registerIngestionCron } from './schedules';

describe('ingestion schedules', () => {
  it('enqueues an incremental pass every six hours and a liveness pass at 03:00', () => {
    const schedules = ingestionSchedules();
    expect(schedules.map((item) => item.expression)).toEqual(['0 */6 * * *', '0 3 * * *']);
    expect(schedules[0]?.jobType).toBe(JOB_INCREMENTAL);
    expect(schedules[1]?.jobType).toBe(JOB_LIVENESS);
    expect(schedules[0]?.sources).toEqual([
      VacancySource.RabotaBy,
      VacancySource.Gsz,
      VacancySource.HabrCareer,
    ]);
  });

  it('registers callbacks that enqueue one job per source and ignores other sources', () => {
    const queued: Array<{ source: VacancySource; jobType: string }> = [];
    const recorded: Array<{ expression: string }> = [];
    registerIngestionCron(
      {
        schedule: (expression, task) => {
          recorded.push({ expression });
          task();
        },
      },
      {
        add: async (job) => {
          queued.push(job);
        },
      },
    );
    expect(recorded).toHaveLength(2);
    expect(queued).toHaveLength(6);
    expect(queued.filter((job) => job.jobType === JOB_LIVENESS)).toHaveLength(3);
    expect(bullQueueName()).toBe(`${QUEUE_PREFIX}:ingest`);
  });
});
