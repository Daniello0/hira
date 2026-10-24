import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { validatedBody } from '../auth/validation-exception';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { mapAccountError } from '../auth/account-http';
import { requireUserId } from '../auth/require-user-id';
import { actorHint } from '../chat/actor-hint';
import { ChatService } from '../chat/chat.service';
import { COLLECTION_DESCRIPTION_MAX, COLLECTION_NAME_MAX } from './favorite.constants';
import { FavoriteService } from './favorite.service';

class CreateCollectionBody {
  @ApiProperty({ type: String, minLength: 1, maxLength: COLLECTION_NAME_MAX })
  @IsString()
  @MinLength(1)
  @MaxLength(COLLECTION_NAME_MAX)
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: COLLECTION_DESCRIPTION_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(COLLECTION_DESCRIPTION_MAX)
  description?: string | null;
}

class UpdateCollectionBody {
  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: COLLECTION_NAME_MAX })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(COLLECTION_NAME_MAX)
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: COLLECTION_DESCRIPTION_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(COLLECTION_DESCRIPTION_MAX)
  description?: string | null;
}

/** Groups of saved vacancies. Deleting one keeps the vacancies. */
@ApiTags('collections')
@ApiBearerAuth()
@UseGuards(OptionalAccessGuard)
@Controller()
export class CollectionController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(FavoriteService) private readonly favorites: FavoriteService,
  ) {}

  /** Lists the account's collections. */
  @Get('collections')
  @ApiOperation({ summary: 'List collections' })
  list(@Req() request: Request) {
    return this.call(request, (userId) => this.favorites.listCollections(userId));
  }

  /** Creates a collection. It is not the default list. */
  @Post('collections')
  @ApiOperation({ summary: 'Create a collection' })
  create(@Body(validatedBody(CreateCollectionBody)) body: CreateCollectionBody, @Req() request: Request) {
    return this.call(request, (userId) => this.favorites.createCollection(userId, body));
  }

  /** Renames a collection. */
  @Patch('collections/:id')
  @ApiOperation({ summary: 'Update a collection' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(validatedBody(UpdateCollectionBody)) body: UpdateCollectionBody,
    @Req() request: Request,
  ) {
    return this.call(request, (userId) => this.favorites.updateCollection(userId, id, body));
  }

  /** Deletes a collection and detaches its favorites. */
  @Delete('collections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a collection' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.call(request, (userId) => this.favorites.deleteCollection(userId, id));
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
