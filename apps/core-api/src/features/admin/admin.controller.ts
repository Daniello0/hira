import { Controller, Get, HttpStatus, Inject, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Request } from 'express';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { apiError } from '../auth/auth-http';
import { requireUserId } from '../auth/require-user-id';
import { validatedBody } from '../auth/validation-exception';
import { actorHint } from '../chat/actor-hint';
import { mapRouteError } from '../chat/chat-http';
import { ChatService } from '../chat/chat.service';
import { ADMIN_REQUIRED, DEFAULT_RUNS_LIMIT, MAX_RUNS_LIMIT } from './admin.constants';
import { AdminRequiredError } from './admin.errors';
import { AdminService } from './admin.service';

class RunsQuery {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: MAX_RUNS_LIMIT, default: DEFAULT_RUNS_LIMIT })
  @Transform(({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_RUNS_LIMIT)
  limit?: number;
}

/** Operator routes. The ADMIN role is read from `users.role` on every call. */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(OptionalAccessGuard)
@Controller('admin')
export class AdminController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(AdminService) private readonly admin: AdminService,
  ) {}

  /** Ingestion runs, newest first. */
  @Get('ingestion/runs')
  @ApiOperation({ summary: 'List ingestion runs (ADMIN)' })
  async runs(@Query(validatedBody(RunsQuery)) query: RunsQuery, @Req() request: Request) {
    try {
      await this.admin.assertAdmin(requireUserId(this.chats.caller(actorHint(request))));
      return await this.admin.runs(query.limit ?? DEFAULT_RUNS_LIMIT);
    } catch (error) {
      if (error instanceof AdminRequiredError) throw apiError(HttpStatus.FORBIDDEN, ADMIN_REQUIRED, error.message, request);
      const http = mapRouteError(error, request);
      if (http !== null) throw http;
      throw error;
    }
  }
}
