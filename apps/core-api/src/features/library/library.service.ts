import { createHash, randomUUID } from 'node:crypto';
import { Injectable, Inject } from '@nestjs/common';
import {
  AuthorKind,
  DocumentFormat,
  DocumentKind,
  ParseStatus,
} from '@hira/contracts';
import {
  DOCUMENT_NOT_FOUND_MESSAGE,
  PDF_CONTENT_LOCKED_MESSAGE,
  PDF_MAX_BYTES,
  PDF_TEXT_EMPTY_MESSAGE,
  PDF_TOO_LARGE_MESSAGE,
  RESUME_TEXT_MESSAGE,
  TEXT_MAX_CHARS,
  TEXT_TOO_LONG_MESSAGE,
} from '../memory/memory.constants';
import { pickDraftTarget, type DraftTarget } from './draft-target';
import {
  FILE_STORE,
  LIBRARY_STORE,
  PDF_READER,
  TEXT_EMBEDDER,
  type FileStore,
  type LibraryDocument,
  type LibraryStore,
  type LibrarySummary,
  type PdfReader,
} from './library.store';

export class LibraryInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LibraryInputError';
  }
}

/** The document is missing or belongs to another account. */
export class DocumentNotFoundError extends Error {
  constructor() {
    super(DOCUMENT_NOT_FOUND_MESSAGE);
    this.name = 'DocumentNotFoundError';
  }
}

export interface TextDocumentInput {
  userId: string;
  kind: DocumentKind;
  title: string;
  format: DocumentFormat;
  content: string;
  /** The user confirmed a draft Hira proposed. */
  fromAssistant?: boolean;
}

interface NewDocument {
  userId: string;
  kind: DocumentKind;
  title: string;
  format: DocumentFormat;
  text: string;
  parseStatus: ParseStatus | null;
  bytes: Buffer;
  createdBy: AuthorKind;
}

/** Creates, reads, and deletes library files. The model never writes here by itself. */
@Injectable()
export class LibraryService {
  constructor(
    @Inject(LIBRARY_STORE) private readonly documents: LibraryStore,
    @Inject(FILE_STORE) private readonly files: FileStore,
    @Inject(PDF_READER) private readonly pdf: PdfReader,
    @Inject(TEXT_EMBEDDER) private readonly embed: (text: string) => Promise<number[] | null>,
  ) {}

  /** Lists files without their bodies. */
  async summaries(userId: string): Promise<LibrarySummary[]> {
    return this.documents.list(userId);
  }

  /** The file a draft request names by title, with its text. Null when none is named. */
  async draftTarget(userId: string, text: string): Promise<DraftTarget | null> {
    const picked = pickDraftTarget(await this.documents.list(userId), text);
    if (picked === null) return null;
    const document = await this.documents.find(userId, picked.id);
    if (document === null) return null;
    return { id: document.id, title: document.title, kind: document.kind, content: document.extractedText };
  }

  /** One file, or null when it belongs to someone else. */
  find(userId: string, id: string): Promise<LibraryDocument | null> {
    return this.documents.find(userId, id);
  }

  /** Stores Markdown or text. Preferences start pinned. */
  async createText(input: TextDocumentInput): Promise<LibraryDocument> {
    if (input.kind === DocumentKind.Resume || input.format === DocumentFormat.Pdf) {
      throw new LibraryInputError(RESUME_TEXT_MESSAGE);
    }
    if (input.content.length > TEXT_MAX_CHARS) throw new LibraryInputError(TEXT_TOO_LONG_MESSAGE);
    return this.persist({
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      format: input.format,
      text: input.content,
      parseStatus: null,
      bytes: Buffer.from(input.content),
      createdBy: input.fromAssistant === true ? AuthorKind.Assistant : AuthorKind.User,
    });
  }

  /** Stores a resume PDF. Parsing is finished by `setParseStatus`. */
  async createPdf(userId: string, title: string, bytes: Buffer): Promise<LibraryDocument> {
    if (bytes.length > PDF_MAX_BYTES) throw new LibraryInputError(PDF_TOO_LARGE_MESSAGE);
    const text = (await this.pdf.read(bytes)).trim();
    if (text.length === 0) throw new LibraryInputError(PDF_TEXT_EMPTY_MESSAGE);
    return this.persist({
      userId,
      kind: DocumentKind.Resume,
      title,
      format: DocumentFormat.Pdf,
      text,
      parseStatus: ParseStatus.Pending,
      bytes,
      createdBy: AuthorKind.User,
    });
  }

  /** Records whether resume parsing produced suggestions. */
  async setParseStatus(userId: string, id: string, status: ParseStatus): Promise<void> {
    await this.documents.update(userId, id, { parseStatus: status });
  }

  /** Updates title, pin, or Markdown/text. PDF body edits are rejected. */
  async update(
    userId: string,
    id: string,
    patch: { title?: string; content?: string; isPinned?: boolean },
  ): Promise<LibraryDocument | null> {
    const current = await this.documents.find(userId, id);
    if (current === null) return null;
    if (patch.content !== undefined && current.format === DocumentFormat.Pdf) {
      throw new LibraryInputError(PDF_CONTENT_LOCKED_MESSAGE);
    }
    const next = await this.applyPatch(current, patch);
    return next;
  }

  /**
   * Removes the bytes, then the row. A missing file is not an error, so a row whose
   * file was already lost can still be deleted; a failed file removal keeps the row.
   */
  async remove(userId: string, id: string): Promise<boolean> {
    const current = await this.documents.find(userId, id);
    if (current === null) return false;
    await this.files.remove(userId, id);
    return (await this.documents.delete(userId, id)) !== null;
  }

  private async persist(input: NewDocument): Promise<LibraryDocument> {
    const document = await this.newDocument(input);
    const stored = await this.documents.insert(document);
    try {
      await this.files.write(input.userId, document.id, input.bytes);
    } catch (error) {
      await this.documents.delete(input.userId, document.id);
      throw error;
    }
    return stored;
  }

  private async newDocument(input: NewDocument): Promise<LibraryDocument> {
    const id = randomUUID();
    const now = new Date();
    return {
      id,
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      format: input.format,
      storagePath: `storage/${input.userId}/${id}`,
      contentHash: createHash('sha256').update(input.text).digest('hex'),
      extractedText: input.text,
      embedding: await this.embed(input.text),
      isPinned: input.kind === DocumentKind.Resume || input.kind === DocumentKind.Preferences,
      createdBy: input.createdBy,
      parseStatus: input.parseStatus,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async applyPatch(
    current: LibraryDocument,
    patch: { title?: string; content?: string; isPinned?: boolean },
  ): Promise<LibraryDocument> {
    const content = patch.content;
    const textPatch = content === undefined ? {} : await this.textPatch(content);
    const updated = await this.documents.update(current.userId, current.id, {
      ...(patch.title === undefined ? {} : { title: patch.title }),
      ...(patch.isPinned === undefined ? {} : { isPinned: patch.isPinned }),
      ...textPatch,
    });
    if (updated === null) return current;
    if (content !== undefined) await this.files.write(current.userId, current.id, Buffer.from(content));
    return updated;
  }

  private async textPatch(content: string): Promise<Partial<LibraryDocument>> {
    if (content.length > TEXT_MAX_CHARS) throw new LibraryInputError(TEXT_TOO_LONG_MESSAGE);
    return {
      extractedText: content,
      contentHash: createHash('sha256').update(content).digest('hex'),
      embedding: await this.embed(content),
    };
  }
}
