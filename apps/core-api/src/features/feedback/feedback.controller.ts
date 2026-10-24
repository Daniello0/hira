import { Body, Controller, HttpStatus, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { FeedbackRating, type CreateFeedbackRequest } from '@hira/contracts';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { apiError } from '../auth/auth-http';
import { requireUserId } from '../auth/require-user-id';
import { validatedBody } from '../auth/validation-exception';
import { actorHint } from '../chat/actor-hint';
import { mapRouteError } from '../chat/chat-http';
import { ChatService } from '../chat/chat.service';
import { FEEDBACK_COMMENT_MAX, MESSAGE_NOT_FOUND } from './feedback.constants';
import { MessageMissingError } from './feedback.errors';
import { FeedbackService } from './feedback.service';

class FeedbackBody implements CreateFeedbackRequest {
  @ApiProperty({ type: String, format: 'uuid', description: 'Assistant message that showed the vacancy' })
  @IsUUID()
  messageId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  vacancyId!: string;

  @ApiProperty({ enum: FeedbackRating })
  @IsEnum(FeedbackRating)
  rating!: FeedbackRating;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: FEEDBACK_COMMENT_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_COMMENT_MAX)
  comment?: string | null;
}

/** Relevant / irrelevant votes. Account only. */
@ApiTags('feedback')
@ApiBearerAuth()
@UseGuards(OptionalAccessGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(FeedbackService) private readonly feedback: FeedbackService,
  ) {}

  /** Stores or replaces the vote on one vacancy of one message. */
  @Post()
  @ApiOperation({ summary: 'Vote on a shown vacancy' })
  async create(@Body(validatedBody(FeedbackBody)) body: FeedbackBody, @Req() request: Request) {
    try {
      return await this.feedback.vote(requireUserId(this.chats.caller(actorHint(request))), body);
    } catch (error) {
      if (error instanceof MessageMissingError) throw apiError(HttpStatus.NOT_FOUND, MESSAGE_NOT_FOUND, error.message, request);
      const http = mapRouteError(error, request);
      if (http !== null) throw http;
      throw error;
    }
  }
}
