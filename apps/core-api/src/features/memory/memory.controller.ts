import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CLOCK, type Clock } from '../../common/utils/clock';
import { TEXT_EMBEDDER } from '../library/library.store';
import { validatedBody } from '../auth/validation-exception';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { actorHint } from '../chat/actor-hint';
import { ChatService } from '../chat/chat.service';
import { mapAccountError } from '../auth/account-http';
import { requireUserId } from '../auth/require-user-id';
import { USER_STORE, type UserStore } from '../auth/user.store';
import { MemoryService } from './memory.service';

class MemoryPatchBody {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

class MemorySettingsBody {
  @IsBoolean()
  crossChatMemory!: boolean;
}

/** What the account has been told Hira remembers. */
@ApiTags('memory')
@ApiBearerAuth()
@UseGuards(OptionalAccessGuard)
@Controller()
export class MemoryController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(MemoryService) private readonly memory: MemoryService,
    @Inject(USER_STORE) private readonly users: UserStore,
    @Inject(TEXT_EMBEDDER) private readonly embed: (text: string) => Promise<number[] | null>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Lists live facts, including expired goals. */
  @Get('memory')
  @ApiOperation({ summary: 'List memory' })
  list(@Req() request: Request) {
    return this.call(request, (userId) => this.memory.list(userId));
  }

  /** Edits one fact. */
  @Patch('memory/:id')
  @ApiOperation({ summary: 'Edit memory' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(validatedBody(MemoryPatchBody)) body: MemoryPatchBody,
    @Req() request: Request,
  ) {
    return this.call(request, async (userId) => {
      const embedding = body.content === undefined ? undefined : await this.embed(body.content);
      const updated = await this.memory.patch(userId, id, body, embedding);
      if (updated === null) throw notFound();
      return updated;
    });
  }

  /** Forgets one fact. */
  @Delete('memory/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Forget one fact' })
  forget(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.call(request, (userId) => this.memory.forget(userId, id, this.clock.now()));
  }

  /** Forgets every live fact. */
  @Delete('memory')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Forget all facts' })
  forgetAll(@Req() request: Request) {
    return this.call(request, (userId) => this.memory.forgetAll(userId, this.clock.now()));
  }

  /** Turns cross-chat memory on or off without deleting facts. */
  @Patch('settings/memory')
  @ApiOperation({ summary: 'Set cross-chat memory' })
  settings(@Body(validatedBody(MemorySettingsBody)) body: MemorySettingsBody, @Req() request: Request) {
    return this.call(request, async (userId) => {
      await this.users.setCrossChatMemory(userId, body.crossChatMemory);
      return { crossChatMemory: body.crossChatMemory };
    });
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

function notFound(): Error {
  const error = new Error('Memory fact was not found');
  error.name = 'MemoryNotFoundError';
  return error;
}
