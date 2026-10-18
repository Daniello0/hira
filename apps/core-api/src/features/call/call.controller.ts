import { Body, Controller, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { validatedBody } from '../auth/validation-exception';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { mapAccountError } from '../auth/account-http';
import { requireUserId } from '../auth/require-user-id';
import { actorHint } from '../chat/actor-hint';
import { failStream, openSse, writeSse } from '../chat/chat-http';
import { ChatService } from '../chat/chat.service';
import { CallMissingError } from './call.errors';
import { CALL_STORE, type CallStore } from './call.store';
import { SearchOrchestratorService } from '../search-orchestrator/search-orchestrator.service';

class CallTurnBody {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsBoolean()
  useMemory?: boolean;
}

/** Voice-call transcripts. A call never appears in the chat list. */
@ApiTags('calls')
@ApiBearerAuth()
@UseGuards(OptionalAccessGuard)
@Controller('calls')
export class CallController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(CALL_STORE) private readonly calls: CallStore,
    @Inject(SearchOrchestratorService) private readonly search: SearchOrchestratorService,
  ) {}

  /** Starts a call for the signed-in account. */
  @Post()
  @ApiOperation({ summary: 'Start a call' })
  start(@Req() request: Request) {
    return this.call(request, async (userId) => {
      const session = await this.calls.insertSession(userId, new Date());
      return { id: session.id, startedAt: session.startedAt.toISOString(), endedAt: null };
    });
  }

  /** Streams one spoken turn with the same events as a chat message. */
  @Post(':id/turns')
  @HttpCode(HttpStatus.OK)
  @ApiProduces('text/event-stream')
  @ApiOperation({ summary: 'Send a call turn' })
  async turn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(validatedBody(CallTurnBody)) body: CallTurnBody,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const userId = requireUserId(this.chats.caller(actorHint(request)));
      const session = await this.calls.findSession(id);
      if (session === null || session.userId !== userId) throw new CallMissingError();
      await this.search.postCall(
        { caller: { kind: 'user', userId }, session, content: body.content, requestId: request.header('x-request-id') ?? 'call', useMemory: body.useMemory },
        { open: () => openSse(response), write: (event, data) => writeSse(response, event, data) },
      );
      response.end();
    } catch (error) {
      failStream(error, request, response);
    }
  }

  /** Ends a call. A second end keeps the original time. */
  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End a call' })
  end(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.call(request, async (userId) => {
      const session = await this.calls.endSession(id, userId, new Date());
      if (session === null) throw new CallMissingError();
      return { id: session.id, startedAt: session.startedAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null };
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
