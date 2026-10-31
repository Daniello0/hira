import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { validatedBody } from '../auth/validation-exception';
import { actorHint } from './actor-hint';
import { CHAT_PAGE_SIZE } from './chat.constants';
import { ChatPageQueryDto, UpdateChatBodyDto } from './chat.dto';
import { mapChatError } from './chat-http';
import { ChatService } from './chat.service';

/** Chat list and lifecycle. Sending a message lives on the search orchestrator. */
@ApiTags('chats')
@ApiBearerAuth()
@Controller('chats')
@UseGuards(OptionalAccessGuard)
export class ChatController {
  constructor(@Inject(ChatService) private readonly chats: ChatService) {}

  /** Lists chats, optionally by a part of the title (`q`). A demo session gets its one chat on the first call. */
  @Get()
  @ApiOperation({ summary: 'List chats' })
  list(@Query(validatedBody(ChatPageQueryDto)) query: ChatPageQueryDto, @Req() request: Request) {
    return this.call(request, async () => {
      const caller = this.chats.caller(actorHint(request));
      return this.chats.list(caller, query.cursor, query.limit ?? CHAT_PAGE_SIZE, query.q);
    });
  }

  /** Creates an empty chat. The title arrives with the first message. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a chat' })
  create(@Req() request: Request) {
    return this.call(request, async () => {
      const caller = this.chats.caller(actorHint(request));
      return this.chats.create(caller);
    });
  }

  /** Older messages, oldest first inside the page. */
  @Get(':chatId/messages')
  @ApiOperation({ summary: 'List messages' })
  messages(
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Query(validatedBody(ChatPageQueryDto)) query: ChatPageQueryDto,
    @Req() request: Request,
  ) {
    return this.call(request, async () => {
      const caller = this.chats.caller(actorHint(request));
      return this.chats.messages(caller, chatId, query.cursor, query.limit ?? CHAT_PAGE_SIZE);
    });
  }

  /** Chat plus the newest page of messages. */
  @Get(':chatId')
  @ApiOperation({ summary: 'Get a chat' })
  detail(@Param('chatId', ParseUUIDPipe) chatId: string, @Req() request: Request) {
    return this.call(request, async () => {
      const caller = this.chats.caller(actorHint(request));
      return this.chats.detail(caller, chatId, undefined, CHAT_PAGE_SIZE);
    });
  }

  /** Renames or archives a chat. */
  @Patch(':chatId')
  @ApiOperation({ summary: 'Rename or archive a chat' })
  update(
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Body(validatedBody(UpdateChatBodyDto)) body: UpdateChatBodyDto,
    @Req() request: Request,
  ) {
    return this.call(request, async () => {
      const caller = this.chats.caller(actorHint(request));
      return this.chats.update(caller, chatId, body);
    });
  }

  /** Deletes a chat and its messages. */
  @Delete(':chatId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a chat' })
  async remove(@Param('chatId', ParseUUIDPipe) chatId: string, @Req() request: Request): Promise<void> {
    await this.call(request, async () => {
      const caller = this.chats.caller(actorHint(request));
      await this.chats.remove(caller, chatId);
    });
  }

  private async call<T>(request: Request, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      const http = mapChatError(error, request);
      if (http !== null) throw http;
      throw error;
    }
  }
}
