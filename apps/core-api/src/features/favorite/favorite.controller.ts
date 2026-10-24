import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { validatedBody } from '../auth/validation-exception';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { mapAccountError } from '../auth/account-http';
import { requireUserId } from '../auth/require-user-id';
import { actorHint } from '../chat/actor-hint';
import { ChatService } from '../chat/chat.service';
import { FAVORITE_NOTE_MAX } from './favorite.constants';
import { readFavoriteQuery } from './favorite-query';
import { FavoriteService } from './favorite.service';

class CreateFavoriteBody {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  vacancyId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  collectionId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: FAVORITE_NOTE_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(FAVORITE_NOTE_MAX)
  note?: string | null;
}

class UpdateFavoriteBody {
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  collectionId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: FAVORITE_NOTE_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(FAVORITE_NOTE_MAX)
  note?: string | null;
}

/** Saved vacancies for a registered account. */
@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(OptionalAccessGuard)
@Controller()
export class FavoriteController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(FavoriteService) private readonly favorites: FavoriteService,
  ) {}

  /** Lists saved vacancies. `q` matches the note, ignoring case. */
  @Get('favorites')
  @ApiOperation({ summary: 'List favorites' })
  @ApiQuery({ name: 'collectionId', required: false, type: String })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Substring of the note, ignoring case' })
  list(@Query('collectionId') collectionId: string | undefined, @Query('q') q: string | undefined, @Req() request: Request) {
    return this.call(request, (userId) => this.favorites.list(userId, readFavoriteQuery(collectionId, q)));
  }

  /** Saves a vacancy. Saving it again returns the same row. */
  @Post('favorites')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save a vacancy' })
  create(@Body(validatedBody(CreateFavoriteBody)) body: CreateFavoriteBody, @Req() request: Request) {
    return this.call(request, (userId) => this.favorites.save(userId, body));
  }

  /** Changes the collection or the note. */
  @Patch('favorites/:id')
  @ApiOperation({ summary: 'Update a favorite' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(validatedBody(UpdateFavoriteBody)) body: UpdateFavoriteBody,
    @Req() request: Request,
  ) {
    return this.call(request, (userId) => this.favorites.update(userId, id, body));
  }

  /** Removes a saved vacancy. */
  @Delete('favorites/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a favorite' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.call(request, (userId) => this.favorites.remove(userId, id));
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
