import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentFormat, DocumentKind, ParseStatus, type DocumentSummaryDto } from '@hira/contracts';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { LLM_GATEWAY } from '../search-orchestrator/search.constants';
import type { LlmGateway } from '../search-orchestrator/upstream-gateway';
import { validatedBody } from '../auth/validation-exception';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { mapAccountError } from '../auth/account-http';
import { requireUserId } from '../auth/require-user-id';
import { actorHint } from '../chat/actor-hint';
import { ChatService } from '../chat/chat.service';
import { ProfileService } from '../profile/profile.service';
import { LibraryInputError, LibraryService } from './library.service';
import { PDF_MAX_BYTES, PDF_TOO_LARGE_MESSAGE } from '../memory/memory.constants';

class TextDocumentBody {
  @IsEnum(DocumentKind)
  kind!: DocumentKind;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  title!: string;

  @IsEnum(DocumentFormat)
  format!: DocumentFormat;

  @IsString()
  @MinLength(1)
  content!: string;
}

class DocumentPatchBody {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

interface UploadFile {
  buffer: Buffer;
  size: number;
  originalname?: string;
}

/** Personal library. Demo sessions are rejected. */
@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(OptionalAccessGuard)
@Controller('documents')
export class DocumentController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(LibraryService) private readonly library: LibraryService,
    @Inject(ProfileService) private readonly profiles: ProfileService,
    @Inject(LLM_GATEWAY) private readonly llm: LlmGateway,
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
      if (document === null) throw missing();
      return { ...summaryOf(document), extractedText: document.extractedText };
    });
  }

  /** Creates Markdown or text, or uploads a resume PDF. */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PDF_MAX_BYTES + 1 } }))
  @ApiOperation({ summary: 'Create a document' })
  create(@UploadedFile() file: UploadFile | undefined, @Body() body: Partial<TextDocumentBody>, @Req() request: Request) {
    return this.call(request, async (userId) => {
      if (file !== undefined) return this.createPdf(userId, file, request);
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
      if (document === null) throw missing();
      return summaryOf(document);
    });
  }

  /** Deletes the file and its row. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.call(request, async (userId) => {
      if (!(await this.library.remove(userId, id))) throw missing();
    });
  }

  private async createPdf(userId: string, file: UploadFile, request: Request) {
    if (file.size > PDF_MAX_BYTES) throw new LibraryInputError(PDF_TOO_LARGE_MESSAGE);
    const title = file.originalname?.trim() || 'Resume';
    const document = await this.library.createPdf(userId, title, file.buffer);
    try {
      const parsed = await this.llm.parseResume({ resumeText: document.extractedText }, requestId(request));
      await this.profiles.offerResume(userId, document.id, parsed.skills, parsed.experience);
      await this.library.setParseStatus(userId, document.id, ParseStatus.Success);
    } catch {
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
      if (isMissing(error)) throw mapAccountError(new LibraryInputError('Document was not found'), request) ?? error;
      throw error;
    }
  }
}

function summaryOf(document: { id: string; kind: DocumentKind; title: string; format: DocumentFormat; isPinned: boolean; parseStatus: ParseStatus | null; createdAt: Date }): DocumentSummaryDto {
  return {
    id: document.id,
    kind: document.kind,
    title: document.title,
    format: document.format,
    isPinned: document.isPinned,
    parseStatus: document.parseStatus,
    createdAt: document.createdAt.toISOString(),
  };
}

function missing(): Error {
  const error = new Error('missing');
  error.name = 'DocumentMissingError';
  return error;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && error.name === 'DocumentMissingError';
}

function readTextBody(body: Partial<TextDocumentBody>): TextDocumentBody {
  if (body.kind === undefined || body.title === undefined || body.format === undefined || body.content === undefined) {
    throw new LibraryInputError('Document fields are incomplete');
  }
  return { kind: body.kind, title: body.title, format: body.format, content: body.content };
}

function requestId(request: Request): string {
  const value = request.header('x-request-id');
  return value === undefined || value.length === 0 ? 'document' : value;
}
