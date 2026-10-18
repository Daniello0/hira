import { createHash, randomUUID } from 'node:crypto';
import { Injectable, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  AuthorKind,
  DocumentFormat,
  DocumentKind,
  ParseStatus,
} from '@hira/contracts';
import { DataSource } from 'typeorm';
import { asSql } from '../chat/typeorm-chat.sql';
import { formatVector, parseVector } from '../embed/vector-text';
import type { Sql } from '../chat/typeorm-chat.sql';
import {
  DOCUMENT_NOT_FOUND_MESSAGE,
  PDF_CONTENT_LOCKED_MESSAGE,
  PDF_MAX_BYTES,
  PDF_TEXT_EMPTY_MESSAGE,
  PDF_TOO_LARGE_MESSAGE,
  TEXT_MAX_CHARS,
  TEXT_TOO_LONG_MESSAGE,
} from '../memory/memory.constants';
import { FILE_STORE, LIBRARY_STORE, PDF_READER, TEXT_EMBEDDER, type FileStore, type LibraryDocument, type LibraryStore, type PdfReader } from './library.store';

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
  async summaries(userId: string): Promise<LibraryDocument[]> {
    return this.documents.list(userId);
  }

  /** One file, or null when it belongs to someone else. */
  find(userId: string, id: string): Promise<LibraryDocument | null> {
    return this.documents.find(userId, id);
  }

  /** Stores Markdown or text. Preferences start pinned. */
  async createText(input: TextDocumentInput): Promise<LibraryDocument> {
    if (input.kind === DocumentKind.Resume || input.format === DocumentFormat.Pdf) {
      throw new LibraryInputError(PDF_CONTENT_LOCKED_MESSAGE);
    }
    if (input.content.length > TEXT_MAX_CHARS) throw new LibraryInputError(TEXT_TOO_LONG_MESSAGE);
    return this.persist(input.userId, input.kind, input.title, input.format, input.content, null, Buffer.from(input.content));
  }

  /** Stores a resume PDF. Parsing is finished by `setParseStatus`. */
  async createPdf(userId: string, title: string, bytes: Buffer): Promise<LibraryDocument> {
    if (bytes.length > PDF_MAX_BYTES) throw new LibraryInputError(PDF_TOO_LARGE_MESSAGE);
    const text = (await this.pdf.read(bytes)).trim();
    if (text.length === 0) throw new LibraryInputError(PDF_TEXT_EMPTY_MESSAGE);
    return this.persist(userId, DocumentKind.Resume, title, DocumentFormat.Pdf, text, ParseStatus.Pending, bytes);
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

  /** Removes the row and the bytes. */
  async remove(userId: string, id: string): Promise<boolean> {
    const removed = await this.documents.delete(userId, id);
    if (removed === null) return false;
    await this.files.remove(userId, id);
    return true;
  }

  private async persist(
    userId: string,
    kind: DocumentKind,
    title: string,
    format: DocumentFormat,
    text: string,
    parseStatus: ParseStatus | null,
    bytes: Buffer,
  ): Promise<LibraryDocument> {
    const id = randomUUID();
    const document: LibraryDocument = {
      id,
      userId,
      kind,
      title,
      format,
      storagePath: `storage/${userId}/${id}`,
      contentHash: createHash('sha256').update(text).digest('hex'),
      extractedText: text,
      embedding: await this.embed(text),
      isPinned: kind === DocumentKind.Resume || kind === DocumentKind.Preferences,
      createdBy: AuthorKind.User,
      parseStatus,
      createdAt: new Date(),
    };
    await this.documents.insert(document);
    try {
      await this.files.write(userId, id, bytes);
    } catch (error) {
      await this.documents.delete(userId, id);
      throw error;
    }
    return document;
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

/** PostgreSQL library. */
@Injectable()
export class TypeOrmLibraryStore implements LibraryStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** @inheritdoc */
  list(userId: string): Promise<LibraryDocument[]> {
    return listDocuments(asSql(this.dataSource), userId);
  }

  /** @inheritdoc */
  find(userId: string, id: string): Promise<LibraryDocument | null> {
    return findDocument(asSql(this.dataSource), userId, id);
  }

  /** @inheritdoc */
  insert(document: LibraryDocument): Promise<LibraryDocument> {
    return insertDocument(asSql(this.dataSource), document);
  }

  /** @inheritdoc */
  update(userId: string, id: string, patch: Partial<LibraryDocument>): Promise<LibraryDocument | null> {
    return updateDocument(asSql(this.dataSource), userId, id, patch);
  }

  /** @inheritdoc */
  delete(userId: string, id: string): Promise<LibraryDocument | null> {
    return deleteDocument(asSql(this.dataSource), userId, id);
  }
}

const DOC_COLUMNS = `id, user_id AS "userId", kind::text AS kind, title, format::text AS format,
  storage_path AS "storagePath", content_hash AS "contentHash", extracted_text AS "extractedText",
  embedding::text AS embedding, is_pinned AS "isPinned", created_by::text AS "createdBy",
  parse_status::text AS "parseStatus", created_at AS "createdAt"`;

async function listDocuments(sql: Sql, userId: string): Promise<LibraryDocument[]> {
  return (await query(sql, `SELECT ${DOC_COLUMNS} FROM user_documents WHERE user_id = $1 ORDER BY created_at`, [userId])).map(toDocument);
}

async function findDocument(sql: Sql, userId: string, id: string): Promise<LibraryDocument | null> {
  const rows = await query(sql, `SELECT ${DOC_COLUMNS} FROM user_documents WHERE user_id = $1 AND id = $2`, [userId, id]);
  return rows[0] === undefined ? null : toDocument(rows[0]);
}

async function insertDocument(sql: Sql, document: LibraryDocument): Promise<LibraryDocument> {
  const rows = await query(
    sql,
    `INSERT INTO user_documents (
      id, user_id, kind, title, format, storage_path, content_hash, extracted_text, embedding, is_pinned, created_by, parse_status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector,$10,$11,$12) RETURNING ${DOC_COLUMNS}`,
    [
      document.id,
      document.userId,
      document.kind,
      document.title,
      document.format,
      document.storagePath,
      document.contentHash,
      document.extractedText,
      formatVector(document.embedding),
      document.isPinned,
      document.createdBy,
      document.parseStatus,
    ],
  );
  return toDocument(rows[0]);
}

async function updateDocument(
  sql: Sql,
  userId: string,
  id: string,
  patch: Partial<LibraryDocument>,
): Promise<LibraryDocument | null> {
  const current = await findDocument(sql, userId, id);
  if (current === null) return null;
  const next = { ...current, ...patch, id, userId };
  const rows = await query(
    sql,
    `UPDATE user_documents SET title = $3, extracted_text = $4, content_hash = $5, embedding = $6::vector,
      is_pinned = $7, parse_status = $8 WHERE id = $1 AND user_id = $2 RETURNING ${DOC_COLUMNS}`,
    [id, userId, next.title, next.extractedText, next.contentHash, formatVector(next.embedding), next.isPinned, next.parseStatus],
  );
  return rows[0] === undefined ? null : toDocument(rows[0]);
}

async function deleteDocument(sql: Sql, userId: string, id: string): Promise<LibraryDocument | null> {
  const current = await findDocument(sql, userId, id);
  if (current === null) return null;
  await sql.query('DELETE FROM user_documents WHERE id = $1 AND user_id = $2', [id, userId]);
  return current;
}

async function query(sql: Sql, statement: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const rows = await sql.query(statement, params);
  if (Array.isArray(rows) && rows.length === 2 && Array.isArray(rows[0])) return rows[0] as Record<string, unknown>[];
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function toDocument(row: Record<string, unknown> | undefined): LibraryDocument {
  if (row === undefined) throw new Error('document row is missing');
  return {
    id: String(row.id),
    userId: String(row.userId),
    kind: String(row.kind) as DocumentKind,
    title: String(row.title),
    format: String(row.format) as DocumentFormat,
    storagePath: String(row.storagePath),
    contentHash: String(row.contentHash),
    extractedText: String(row.extractedText),
    embedding: parseVector(row.embedding),
    isPinned: row.isPinned === true,
    createdBy: String(row.createdBy) as AuthorKind,
    parseStatus: row.parseStatus === null || row.parseStatus === undefined ? null : (String(row.parseStatus) as ParseStatus),
    createdAt: new Date(row.createdAt instanceof Date ? row.createdAt : String(row.createdAt)),
  };
}
