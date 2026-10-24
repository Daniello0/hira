import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { AuthorKind, DocumentFormat, DocumentKind, ParseStatus } from '@hira/contracts';
import { DataSource } from 'typeorm';
import { asSql, type Sql } from '../chat/typeorm-chat.sql';
import { typeormRows } from '../database/typeorm-rows';
import { formatVector, parseVector } from '../embed/vector-text';
import { DOCUMENT_CONTEXT_CHARS } from '../memory/memory.constants';
import type { LibraryDocument, LibraryStore, LibrarySummary } from './library.store';

const SUMMARY_COLUMNS = `id::text AS id, user_id::text AS "userId", kind::text AS kind, title, format::text AS format,
  is_pinned AS "isPinned", created_by::text AS "createdBy", parse_status::text AS "parseStatus",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

const DOC_COLUMNS = `${SUMMARY_COLUMNS}, storage_path AS "storagePath", content_hash AS "contentHash",
  extracted_text AS "extractedText", embedding::text AS embedding`;

/** Prompt rows: text clipped to the turn budget, no vector. */
const PROMPT_COLUMNS = `${SUMMARY_COLUMNS}, storage_path AS "storagePath", content_hash AS "contentHash",
  left(extracted_text, ${DOCUMENT_CONTEXT_CHARS}) AS "extractedText", NULL::text AS embedding`;

/** PostgreSQL library. */
@Injectable()
export class TypeOrmLibraryStore implements LibraryStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** @inheritdoc */
  async list(userId: string): Promise<LibrarySummary[]> {
    const rows = await query(this.sql(), `SELECT ${SUMMARY_COLUMNS} FROM user_documents WHERE user_id = $1 ORDER BY created_at, id`, [userId]);
    return rows.map(toSummary);
  }

  /** @inheritdoc */
  async forPrompt(userId: string, vector: readonly number[] | null, neighborLimit: number): Promise<LibraryDocument[]> {
    const pinned = await query(this.sql(), `SELECT ${PROMPT_COLUMNS} FROM user_documents WHERE user_id = $1 AND is_pinned ORDER BY created_at, id`, [userId]);
    const nearest = await query(this.sql(), neighborSql(vector), neighborParams(userId, vector, neighborLimit));
    return [...pinned, ...nearest].map(toDocument);
  }

  /** @inheritdoc */
  async find(userId: string, id: string): Promise<LibraryDocument | null> {
    return findDocument(this.sql(), userId, id);
  }

  /** @inheritdoc */
  async insert(document: LibraryDocument): Promise<LibraryDocument> {
    const rows = await query(this.sql(), INSERT_SQL, insertParams(document));
    return toDocument(rows[0]);
  }

  /** @inheritdoc */
  async update(userId: string, id: string, patch: Partial<LibraryDocument>): Promise<LibraryDocument | null> {
    const current = await findDocument(this.sql(), userId, id);
    if (current === null) return null;
    const next = { ...current, ...patch, id, userId };
    const rows = await query(this.sql(), UPDATE_SQL, [
      id, userId, next.title, next.extractedText, next.contentHash, formatVector(next.embedding), next.isPinned, next.parseStatus,
    ]);
    return rows[0] === undefined ? null : toDocument(rows[0]);
  }

  /** @inheritdoc */
  async delete(userId: string, id: string): Promise<LibraryDocument | null> {
    const rows = await query(this.sql(), `DELETE FROM user_documents WHERE id = $1 AND user_id = $2 RETURNING ${DOC_COLUMNS}`, [id, userId]);
    return rows[0] === undefined ? null : toDocument(rows[0]);
  }

  private sql(): Sql {
    return asSql(this.dataSource);
  }
}

const INSERT_SQL = `INSERT INTO user_documents (
  id, user_id, kind, title, format, storage_path, content_hash, extracted_text, embedding, is_pinned, created_by, parse_status
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector,$10,$11,$12) RETURNING ${DOC_COLUMNS}`;

const UPDATE_SQL = `UPDATE user_documents SET title = $3, extracted_text = $4, content_hash = $5, embedding = $6::vector,
  is_pinned = $7, parse_status = $8 WHERE id = $1 AND user_id = $2 RETURNING ${DOC_COLUMNS}`;

function neighborSql(vector: readonly number[] | null): string {
  const base = `SELECT ${PROMPT_COLUMNS} FROM user_documents WHERE user_id = $1 AND NOT is_pinned`;
  if (vector === null) return `${base} ORDER BY updated_at DESC, id LIMIT $2`;
  return `${base} AND embedding IS NOT NULL ORDER BY embedding <=> $3::vector, id LIMIT $2`;
}

function neighborParams(userId: string, vector: readonly number[] | null, limit: number): unknown[] {
  if (vector === null) return [userId, limit];
  return [userId, limit, formatVector(vector)];
}

function insertParams(document: LibraryDocument): unknown[] {
  return [
    document.id, document.userId, document.kind, document.title, document.format, document.storagePath,
    document.contentHash, document.extractedText, formatVector(document.embedding), document.isPinned,
    document.createdBy, document.parseStatus,
  ];
}

async function findDocument(sql: Sql, userId: string, id: string): Promise<LibraryDocument | null> {
  const rows = await query(sql, `SELECT ${DOC_COLUMNS} FROM user_documents WHERE user_id = $1 AND id = $2`, [userId, id]);
  return rows[0] === undefined ? null : toDocument(rows[0]);
}

async function query(sql: Sql, statement: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  return typeormRows(await sql.query(statement, params));
}

function toSummary(row: Record<string, unknown>): LibrarySummary {
  return {
    id: String(row.id),
    userId: String(row.userId),
    kind: String(row.kind) as DocumentKind,
    title: String(row.title),
    format: String(row.format) as DocumentFormat,
    isPinned: row.isPinned === true,
    createdBy: String(row.createdBy) as AuthorKind,
    parseStatus: row.parseStatus === null || row.parseStatus === undefined ? null : (String(row.parseStatus) as ParseStatus),
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt ?? row.createdAt),
  };
}

function toDocument(row: Record<string, unknown> | undefined): LibraryDocument {
  if (row === undefined) throw new Error('document row is missing');
  return {
    ...toSummary(row),
    storagePath: String(row.storagePath),
    contentHash: String(row.contentHash),
    extractedText: String(row.extractedText),
    embedding: parseVector(row.embedding),
  };
}

function asDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}
