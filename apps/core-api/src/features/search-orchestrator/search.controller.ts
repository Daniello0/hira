import { Body, Controller, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { InvalidSearchError } from '../chat/chat.errors';
import { readRetrievalBody } from './read-retrieval-body';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { readRequestId } from '../../common/interceptors/request-id.interceptor';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { validatedBody } from '../auth/validation-exception';
import { actorHint } from '../chat/actor-hint';
import { CreateMessageBodyDto } from '../chat/chat.dto';
import { failStream, mapChatError, openSse, writeSse } from '../chat/chat-http';
import { ChatService } from '../chat/chat.service';
import { SearchOrchestratorService } from './search-orchestrator.service';

/** Direct search and the streaming chat turn. */
@ApiTags('search')
@ApiBearerAuth()
@UseGuards(OptionalAccessGuard)
@Controller()
export class SearchController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(SearchOrchestratorService) private readonly search: SearchOrchestratorService,
  ) {}

  /** Reproducible search with no chat. Pass `intent` to skip query understanding. */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search without a chat' })
  async searchVacancies(@Body() body: unknown, @Req() request: Request) {
    try {
      const parsed = readRetrievalBody(body);
      if (parsed === null) throw new InvalidSearchError();
      const caller = this.chats.caller(actorHint(request));
      return await this.search.direct({ caller, request: parsed, requestId: readRequestId(request) });
    } catch (error) {
      const http = mapChatError(error, request);
      if (http !== null) throw http;
      throw error;
    }
  }

  /** Saves the user message and streams intent, cards, and the answer. */
  @Post('chats/:chatId/messages')
  @HttpCode(HttpStatus.OK)
  @ApiProduces('text/event-stream')
  @ApiOperation({ summary: 'Send a message' })
  async send(
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Body(validatedBody(CreateMessageBodyDto)) body: CreateMessageBodyDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const caller = this.chats.caller(actorHint(request));
      const chat = await this.chats.owned(caller, chatId);
      await this.search.postMessage(
        { caller, chat, content: body.content, requestId: readRequestId(request) },
        { open: () => openSse(response), write: (event, data) => writeSse(response, event, data) },
      );
      response.end();
    } catch (error) {
      failStream(error, request, response);
    }
  }
}
