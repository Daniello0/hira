import { VacancySource } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { JOB_EMBED, JOB_EXTRACT_SKILLS, JOB_GRAPH, STAGE_SOURCES } from '../ingestion.constants';
import { registerSkillIndexCron, skillIndexSchedules } from './skill-schedules';

describe('skill index schedules', () => {
  it('extracts and embeds every 15 minutes and refreshes graph stats at 04:00', () => {
    expect(skillIndexSchedules()).toEqual([
      {
        expression: '*/15 * * * *',
        queue: 'extract-skills',
        jobType: JOB_EXTRACT_SKILLS,
        sources: STAGE_SOURCES,
      },
      {
        expression: '*/15 * * * *',
        queue: 'embed',
        jobType: JOB_EMBED,
        sources: STAGE_SOURCES,
      },
      { expression: '0 4 * * *', queue: 'graph', jobType: JOB_GRAPH, sources: [] },
    ]);
  });

  it('enqueues one source job per collection queue and a graph job without a source', () => {
    const queued: Array<{ queue: string; source?: VacancySource; jobType: string }> = [];
    registerSkillIndexCron(
      {
        schedule: (_expression, task) => {
          task();
        },
      },
      {
        add: async (queue, job) => {
          queued.push({ queue, ...job });
        },
      },
    );
    expect(queued.filter((job) => job.jobType === JOB_EXTRACT_SKILLS)).toHaveLength(4);
    expect(queued.filter((job) => job.jobType === JOB_EMBED)).toHaveLength(4);
    expect(queued.filter((job) => job.jobType === JOB_GRAPH)).toEqual([
      { queue: 'graph', jobType: JOB_GRAPH },
    ]);
  });
});
