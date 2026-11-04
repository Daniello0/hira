import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateBy, ValidateNested, type ValidationArguments } from 'class-validator';
import { ATTACHMENT_NAME_MAX_CHARS, ATTACHMENT_TEXT_MAX_CHARS, MAX_MESSAGE_ATTACHMENTS, type CreateMessageRequest, type MessageAttachment, type UpdateChatRequest } from '@hira/contracts';
import {
  CHAT_PAGE_SIZE,
  CHAT_SEARCH_MAX_LENGTH,
  MAX_CHAT_TITLE_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_PAGE_SIZE,
} from './chat.constants';

/** A file of a message, already read to text by `POST /api/v1/documents/read`. */
export class MessageAttachmentDto implements MessageAttachment {
  @ApiProperty({ type: String, minLength: 1, maxLength: ATTACHMENT_NAME_MAX_CHARS })
  @IsString()
  @MinLength(1)
  @MaxLength(ATTACHMENT_NAME_MAX_CHARS)
  name!: string;

  @ApiProperty({ type: String, minLength: 1, maxLength: ATTACHMENT_TEXT_MAX_CHARS })
  @IsString()
  @MinLength(1)
  @MaxLength(ATTACHMENT_TEXT_MAX_CHARS)
  text!: string;
}

/** Body of `POST /api/v1/chats/{chatId}/messages`. */
export class CreateMessageBodyDto implements CreateMessageRequest {
  @ApiProperty({ type: String, minLength: 1, maxLength: MAX_MESSAGE_LENGTH })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @WordsOrFiles()
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

  @ApiPropertyOptional({ type: [MessageAttachmentDto], maxItems: MAX_MESSAGE_ATTACHMENTS, description: 'Files stored after the words, for Hira to read' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MESSAGE_ATTACHMENTS)
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}

/**
 * A message may be only files: then the words can be empty. `@ValidateIf` would switch off every check on
 * the words, so a missing or non-text `content` with files reached the controller.
 */
function WordsOrFiles() {
  return ValidateBy({
    name: 'wordsOrFiles',
    validator: {
      validate: (value: unknown, args?: ValidationArguments) =>
        (typeof value === 'string' && value.length > 0) || ((args?.object as CreateMessageBodyDto | undefined)?.attachments?.length ?? 0) > 0,
      defaultMessage: () => 'content must be longer than or equal to 1 characters',
    },
  });
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
