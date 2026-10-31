import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiExtraModels, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { DocumentFormat, DocumentKind, ParseStatus, type DocumentSummaryDto } from '@hira/contracts';
import { plainToInstance } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength, validateSync } from 'class-validator';
import type { Request } from 'express';
import type { Logger } from 'pino';
import { LOGGER } from '../../common/constants/app.constants';
import { readRequestId } from '../../common/interceptors/request-id.interceptor';
import type { LibrarySummary } from './library.store';
import { LLM_GATEWAY } from '../search-orchestrator/search.constants';
import type { LlmGateway } from '../search-orchestrator/upstream-gateway';
import { validatedBody, validationException } from '../auth/validation-exception';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { mapAccountError } from '../auth/account-http';
import { requireUserId } from '../auth/require-user-id';
import { actorHint } from '../chat/actor-hint';
import { PlanGate } from '../billing/plan-gate';
import { ChatService } from '../chat/chat.service';
import { ProfileService } from '../profile/profile.service';
import { DocumentNotFoundError, LibraryInputError, LibraryService } from './library.service';
import {
  DOCUMENT_TITLE_MAX_CHARS,
  DOCUMENT_TITLE_TOO_LONG_MESSAGE,
  PDF_MAX_BYTES,
  PDF_TOO_LARGE_MESSAGE,
  RESUME_FILE_MESSAGE,
} from '../memory/memory.constants';

class TextDocumentBody {
  @ApiProperty({ enum: DocumentKind })
  @IsEnum(DocumentKind)
  kind!: DocumentKind;

  @ApiProperty({ type: String, minLength: 1, maxLength: DOCUMENT_TITLE_MAX_CHARS })
  @IsString()
  @MinLength(1)
  @MaxLength(DOCUMENT_TITLE_MAX_CHARS)
  title!: string;

  @ApiProperty({ enum: [DocumentFormat.Md, DocumentFormat.Txt] })
  @IsEnum(DocumentFormat)
  format!: DocumentFormat;

  @ApiProperty({ type: String, minLength: 1 })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional({ type: Boolean, description: 'True when the user saves a draft Hira proposed' })
  @IsOptional()
  @IsBoolean()
  fromAssistant?: boolean;
}

class DocumentPatchBody {
  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: DOCUMENT_TITLE_MAX_CHARS })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(DOCUMENT_TITLE_MAX_CHARS)
  title?: string;

  @ApiPropertyOptional({ type: String, description: 'Markdown or text only' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

/** Swagger shape of the resume upload. */
const UPLOAD_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string', format: 'binary', description: 'Resume PDF' },
    kind: { type: 'string', enum: [DocumentKind.Resume] },
    format: { type: 'string', enum: [DocumentFormat.Pdf] },
  },
  required: ['file'],
};

interface UploadFile {
  buffer: Buffer;
  size: number;
  originalname?: string;
}

/** Personal library. Demo sessions are rejected. */
@ApiTags('documents')
@ApiBearerAuth()
@ApiExtraModels(TextDocumentBody, DocumentPatchBody)
@UseGuards(OptionalAccessGuard)
@Controller('documents')
export class DocumentController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(LibraryService) private readonly library: LibraryService,
    @Inject(PlanGate) private readonly plans: PlanGate,
    @Inject(ProfileService) private readonly profiles: ProfileService,
    @Inject(LLM_GATEWAY) private readonly llm: LlmGateway,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /** Lists files without their text. */
  @Get()
  @ApiOperation({ summary: 'List documents' })
  list(@Req() request: Request) {
    return this.call(request, async (userId) => (await this.library.summaries(userId)).map(summaryOf));
  }

  /** One file, including extracted text. */
  @Get(':id')
  @ApiOperation({ summary: 'Read a document' })
  read(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.call(request, async (userId) => {
      const document = await this.library.find(userId, id);
      if (document === null) throw new DocumentNotFoundError();
      return { ...summaryOf(document), extractedText: document.extractedText };
    });
  }

  /** Creates Markdown or text, or uploads a resume PDF. */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PDF_MAX_BYTES + 1 } }))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: { oneOf: [{ $ref: '#/components/schemas/TextDocumentBody' }, UPLOAD_SCHEMA] },
    description: 'JSON for Markdown or text; multipart with `file` for a resume PDF',
  })
  @ApiOperation({ summary: 'Create a document' })
  create(@UploadedFile() file: UploadFile | undefined, @Body() body: Partial<TextDocumentBody>, @Req() request: Request) {
    return this.call(request, async (userId) => {
      await this.plans.requireRoom(userId, 'libraryFiles', (await this.library.summaries(userId)).length);
      if (file !== undefined) {
        assertResumeFile(body);
        return this.createPdf(userId, file, request);
      }
      const text = readTextBody(body);
      const document = await this.library.createText({ userId, ...text });
      return summaryOf(document);
    });
  }

  /** Edits title, pin, or text. */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a document' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(validatedBody(DocumentPatchBody)) body: DocumentPatchBody,
    @Req() request: Request,
  ) {
    return this.call(request, async (userId) => {
      const document = await this.library.update(userId, id, body);
      if (document === null) throw new DocumentNotFoundError();
      return summaryOf(document);
    });
  }

  /** Deletes the file and its row. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.call(request, async (userId) => {
      if (!(await this.library.remove(userId, id))) throw new DocumentNotFoundError();
    });
  }

  private async createPdf(userId: string, file: UploadFile, request: Request) {
    if (file.size > PDF_MAX_BYTES) throw new LibraryInputError(PDF_TOO_LARGE_MESSAGE);
    const title = pdfTitle(file.originalname);
    const document = await this.library.createPdf(userId, title, file.buffer);
    try {
      const parsed = await this.llm.parseResume({ resumeText: document.extractedText }, readRequestId(request));
      await this.profiles.offerResume(userId, document.id, parsed.skills, parsed.experience);
      await this.library.setParseStatus(userId, document.id, ParseStatus.Success);
    } catch (error) {
      this.logger.warn({ err: error, documentId: document.id }, 'resume parsing failed');
      await this.library.setParseStatus(userId, document.id, ParseStatus.Failed);
    }
    const saved = await this.library.find(userId, document.id);
    return summaryOf(saved ?? document);
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

function summaryOf(document: LibrarySummary): DocumentSummaryDto {
  return {
    id: document.id,
    kind: document.kind,
    title: document.title,
    format: document.format,
    isPinned: document.isPinned,
    parseStatus: document.parseStatus,
    createdBy: document.createdBy,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function assertResumeFile(body: Partial<TextDocumentBody>): void {
  if (body.kind !== undefined && body.kind !== DocumentKind.Resume) throw new LibraryInputError(RESUME_FILE_MESSAGE);
  if (body.format !== undefined && body.format !== DocumentFormat.Pdf) throw new LibraryInputError(RESUME_FILE_MESSAGE);
}

function readTextBody(body: Partial<TextDocumentBody>): TextDocumentBody {
  const parsed = plainToInstance(TextDocumentBody, body);
  const errors = validateSync(parsed, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length > 0) throw validationException(errors);
  return parsed;
}

function pdfTitle(name: string | undefined): string {
  const title = name?.trim() ?? '';
  if (title.length > DOCUMENT_TITLE_MAX_CHARS) throw new LibraryInputError(DOCUMENT_TITLE_TOO_LONG_MESSAGE);
  if (title.length === 0) return 'Resume';
  return title;
}

