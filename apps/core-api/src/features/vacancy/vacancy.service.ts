import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { SimilarVacanciesDto, SkillGapDto, VacancyDetailDto } from '@hira/contracts';
import { DataSource } from 'typeorm';
import { asSql } from '../chat/typeorm-chat.sql';
import { VacancyMissingError } from '../favorite/favorite.errors';
import { RETRIEVAL_GATEWAY } from '../search-orchestrator/search.constants';
import type { RetrievalGateway } from '../search-orchestrator/upstream-gateway';
import { loadVacancyDetail } from './vacancy-detail.sql';

/** Vacancy card, similar vacancies, and the skill gap (US-6). */
@Injectable()
export class VacancyService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(RETRIEVAL_GATEWAY) private readonly retrieval: RetrievalGateway,
  ) {}

  /** Full card with skills and their evidence. Throws `VacancyMissingError`. */
  async detail(vacancyId: string): Promise<VacancyDetailDto> {
    const detail = await loadVacancyDetail(asSql(this.dataSource), vacancyId);
    if (detail === null) throw new VacancyMissingError();
    return detail;
  }

  /** Nearest vacancies by embedding, computed by retrieval-service. */
  async similar(vacancyId: string, limit: number | undefined, requestId: string): Promise<SimilarVacanciesDto> {
    const response = await this.retrieval.similar(limit === undefined ? { vacancyId } : { vacancyId, limit }, requestId);
    return { items: response.items };
  }

  /** Missing and matched skills against the account's profile, computed by retrieval-service. */
  skillGap(vacancyId: string, userId: string, requestId: string): Promise<SkillGapDto> {
    return this.retrieval.skillGap({ vacancyId, userId }, requestId);
  }
}
