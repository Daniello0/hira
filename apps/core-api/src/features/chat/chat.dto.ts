import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { CreateMessageRequest, UpdateChatRequest } from '@hira/contracts';
import {
  CHAT_PAGE_SIZE,
  CHAT_SEARCH_MAX_LENGTH,
  MAX_CHAT_TITLE_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_PAGE_SIZE,
} from './chat.constants';

/** Body of `POST /api/v1/chats/{chatId}/messages`. */
export class CreateMessageBodyDto implements CreateMessageRequest {
  @ApiProperty({ type: String, minLength: 1, maxLength: MAX_MESSAGE_LENGTH })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MESSAGE_LENGTH)
  content!: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  useMemory?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: '`false` hides foreign remote vacancies for this turn' })
  @IsOptional()
  @IsBoolean()
  includeForeignRemote?: boolean;
}

/** Body of `PATCH /api/v1/chats/{chatId}`. */
export class UpdateChatBodyDto implements UpdateChatRequest {
  @ApiPropertyOptional({ type: String, maxLength: MAX_CHAT_TITLE_LENGTH })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_CHAT_TITLE_LENGTH)
  title?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

/** Query of the chat and message lists. */
export class ChatPageQueryDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ type: String, description: 'Part of the chat title' })
  @IsOptional()
  @IsString()
  @MaxLength(CHAT_SEARCH_MAX_LENGTH)
  q?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: MAX_PAGE_SIZE, default: CHAT_PAGE_SIZE })
  @Transform(({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;
}
