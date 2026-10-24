import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Request } from 'express';
import type { Caller } from '../chat/resolve-actor';
import { readRequestId } from '../../common/interceptors/request-id.interceptor';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { requireUserId } from '../auth/require-user-id';
import { validatedBody } from '../auth/validation-exception';
import { actorHint } from '../chat/actor-hint';
import { mapRouteError } from '../chat/chat-http';
import { ChatService } from '../chat/chat.service';
import { DEFAULT_SIMILAR_LIMIT, MAX_SIMILAR_LIMIT } from './vacancy.constants';
import { VacancyService } from './vacancy.service';

class SimilarQuery {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: MAX_SIMILAR_LIMIT, default: DEFAULT_SIMILAR_LIMIT })
  @Transform(({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SIMILAR_LIMIT)
  limit?: number;
}

/** Vacancy card, similar vacancies, and the skill gap. A demo session may read cards. */
@ApiTags('vacancies')
@ApiBearerAuth()
@UseGuards(OptionalAccessGuard)
@Controller('vacancies')
export class VacancyController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(VacancyService) private readonly vacancies: VacancyService,
  ) {}

  /** Full card with skills and evidence spans. */
  @Get(':id')
  @ApiOperation({ summary: 'Read a vacancy' })
  detail(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.call(request, () => this.vacancies.detail(id));
  }

  /** Nearest vacancies by the vacancy embedding. */
  @Get(':id/similar')
  @ApiOperation({ summary: 'Similar vacancies' })
  similar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(validatedBody(SimilarQuery)) query: SimilarQuery,
    @Req() request: Request,
  ) {
    return this.call(request, () => this.vacancies.similar(id, query.limit, readRequestId(request)));
  }

  /** Skills the profile lacks for this vacancy and the owned skills that lead to them. Account only. */
  @Get(':id/skill-gap')
  @ApiOperation({ summary: 'Skill gap against the profile' })
  skillGap(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.call(request, (caller) => this.vacancies.skillGap(id, requireUserId(caller), readRequestId(request)));
  }

  private async call<T>(request: Request, run: (caller: Caller) => Promise<T>): Promise<T> {
    try {
      return await run(this.chats.caller(actorHint(request)));
    } catch (error) {
      const http = mapRouteError(error, request);
      if (http !== null) throw http;
      throw error;
    }
  }
}
