import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { validatedBody } from '../auth/validation-exception';
import { actorHint } from '../chat/actor-hint';
import { mapRouteError } from '../chat/chat-http';
import { ChatService } from '../chat/chat.service';
import { LOCATION_QUERY_MAX } from './location.constants';
import { LocationService } from './location.service';

class LocationQuery {
  @ApiPropertyOptional({ type: String, maxLength: LOCATION_QUERY_MAX, description: 'Substring of the city or region' })
  @IsOptional()
  @IsString()
  @MaxLength(LOCATION_QUERY_MAX)
  q?: string;
}

/** Place lookup for the profile. An account or a demo session may call it. */
@ApiTags('locations')
@ApiBearerAuth()
@UseGuards(OptionalAccessGuard)
@Controller('locations')
export class LocationController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(LocationService) private readonly locations: LocationService,
  ) {}

  /** Up to 50 places, labelled like vacancy cards. */
  @Get()
  @ApiOperation({ summary: 'Search locations' })
  async search(@Query(validatedBody(LocationQuery)) query: LocationQuery, @Req() request: Request) {
    try {
      this.chats.caller(actorHint(request));
      return await this.locations.search(query.q);
    } catch (error) {
      const http = mapRouteError(error, request);
      if (http !== null) throw http;
      throw error;
    }
  }
}
