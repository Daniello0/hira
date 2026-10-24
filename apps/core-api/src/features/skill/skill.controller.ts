import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SkillSearchHitDto } from '@hira/contracts';
import type { Request } from 'express';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { mapAccountError } from '../auth/account-http';
import { requireUserId } from '../auth/require-user-id';
import { actorHint } from '../chat/actor-hint';
import { ChatService } from '../chat/chat.service';
import { SKILL_QUERY_MIN_LENGTH } from './skill.constants';
import { SKILL_CATALOG, type SkillCatalog } from './skill.store';

/** Catalog autocomplete. Demo sessions are rejected. */
@ApiTags('skills')
@ApiBearerAuth()
@UseGuards(OptionalAccessGuard)
@Controller()
export class SkillController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(SKILL_CATALOG) private readonly catalog: SkillCatalog,
  ) {}

  /** Top catalog matches. Fewer than two characters returns an empty list. */
  @Get('skills')
  @ApiOperation({ summary: 'Search skills' })
  search(@Query('q') q: string | undefined, @Req() request: Request) {
    return this.call(request, () => this.lookup(q));
  }

  private lookup(q: string | undefined): Promise<SkillSearchHitDto[]> {
    const query = (q ?? '').trim();
    if (query.length < SKILL_QUERY_MIN_LENGTH) return Promise.resolve([]);
    return this.catalog.search(query);
  }

  private async call<T>(request: Request, run: (userId: string) => Promise<T>): Promise<T> {
    try {
      return await run(requireUserId(this.chats.caller(actorHint(request))));
    } catch (error) {
      const http = mapAccountError(error, request);
      if (http !== null) throw http;
      throw error;
    }
  }
}
