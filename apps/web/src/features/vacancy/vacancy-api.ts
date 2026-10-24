import type { CreateFeedbackRequest, FeedbackDto, SimilarVacanciesDto, SkillGapDto, VacancyDetailDto } from '@hira/contracts';
import { authedFetch, readJson } from '../../common/api/authed-fetch';
import { jsonRequest } from '../../common/api/core-api';

/** Full vacancy with its skills. Demo sessions may read it. */
export async function fetchVacancy(id: string): Promise<VacancyDetailDto | null> {
  return readJson<VacancyDetailDto>(await authedFetch(`/api/v1/vacancies/${id}`));
}

/** Nearest vacancies by meaning. Demo sessions may read it. */
export async function fetchSimilar(id: string): Promise<SimilarVacanciesDto | null> {
  return readJson<SimilarVacanciesDto>(await authedFetch(`/api/v1/vacancies/${id}/similar`));
}

/** Profile coverage of the vacancy skills. Account only. */
export async function fetchSkillGap(id: string): Promise<SkillGapDto | null> {
  return readJson<SkillGapDto>(await authedFetch(`/api/v1/vacancies/${id}/skill-gap`));
}

/** Stores a relevance vote. A repeated vote replaces the previous one. */
export async function sendFeedback(body: CreateFeedbackRequest): Promise<FeedbackDto | null> {
  return readJson<FeedbackDto>(await authedFetch('/api/v1/feedback', jsonRequest('POST', body)));
}
