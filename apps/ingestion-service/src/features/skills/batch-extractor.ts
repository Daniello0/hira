import type { ExtractedSkill, ExtractSkillsVacancy } from '@hira/contracts';
import { HTTP_TOO_MANY_REQUESTS } from '../ingestion.constants';
import { ExtractHttpError, type ExtractBatchResult } from '../llm-client/extract-client';
import { ExtractionHalted, type PendingSkillVacancy } from './process-skills';

export interface BatchExtractorDeps {
  batchSize: number;
  /** One llm-service call for up to `batchSize` vacancies. */
  request(vacancies: ExtractSkillsVacancy[]): Promise<ExtractBatchResult>;
  /** Spends one call of the daily LLM budget; false when it is used up. */
  allowCall(): Promise<boolean>;
}

/**
 * Groups claimed vacancies into batches and answers `extract(vacancy)` from one shared call per
 * batch, so `processSkillVacancies` keeps its one-vacancy flow while the LLM sees five at once.
 */
export function createBatchExtractor(deps: BatchExtractorDeps) {
  const batches = new Map<string, () => Promise<ExtractBatchResult>>();
  return {
    prime(vacancies: readonly PendingSkillVacancy[]): void {
      batches.clear();
      for (let start = 0; start < vacancies.length; start += deps.batchSize) {
        const group = vacancies.slice(start, start + deps.batchSize);
        const load = once(() => callBatch(deps, group));
        for (const vacancy of group) batches.set(vacancy.id, load);
      }
    },
    async extract(vacancy: PendingSkillVacancy): Promise<ExtractedSkill[]> {
      const load = batches.get(vacancy.id);
      if (load === undefined) throw new Error('vacancy was not claimed in this batch');
      const result = (await load()).get(vacancy.id);
      if (result === undefined) throw new Error('extract-skills returned no result for vacancy');
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

async function callBatch(
  deps: BatchExtractorDeps,
  group: readonly PendingSkillVacancy[],
): Promise<ExtractBatchResult> {
  if (!(await deps.allowCall())) {
    throw new ExtractionHalted('LLM daily budget is used up; extraction resumes tomorrow');
  }
  try {
    return await deps.request(
      group.map(({ id, title, description }) => ({ id, title, description })),
    );
  } catch (error) {
    if (error instanceof ExtractHttpError && error.status === HTTP_TOO_MANY_REQUESTS) {
      throw new ExtractionHalted('LLM rate limit (429); extraction stops until the next tick');
    }
    throw error;
  }
}

/** Runs the loader once; later callers share the same promise (and the same rejection). */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= load();
    return pending;
  };
}
