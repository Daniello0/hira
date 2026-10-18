import { Injectable } from '@nestjs/common';
import type { FileStore, LibraryDocument, LibraryStore } from './library.store';

/** Process-local library. Bytes live in `files`. */
@Injectable()
export class MemoryLibraryStore implements LibraryStore {
  readonly documents: LibraryDocument[] = [];

  /** @inheritdoc */
  async list(userId: string): Promise<LibraryDocument[]> {
    return this.documents.filter((document) => document.userId === userId).map((document) => ({ ...document }));
  }

  /** @inheritdoc */
  async find(userId: string, id: string): Promise<LibraryDocument | null> {
    const document = this.owned(userId, id);
    return document === null ? null : { ...document };
  }

  /** @inheritdoc */
  async insert(document: LibraryDocument): Promise<LibraryDocument> {
    this.documents.push({ ...document });
    return { ...document };
  }

  /** @inheritdoc */
  async update(userId: string, id: string, patch: Partial<LibraryDocument>): Promise<LibraryDocument | null> {
    const document = this.owned(userId, id);
    if (document === null) return null;
    Object.assign(document, patch, { id: document.id, userId: document.userId });
    return { ...document };
  }

  /** @inheritdoc */
  async delete(userId: string, id: string): Promise<LibraryDocument | null> {
    const index = this.documents.findIndex((document) => document.userId === userId && document.id === id);
    if (index < 0) return null;
    const [removed] = this.documents.splice(index, 1);
    return removed === undefined ? null : { ...removed };
  }

  private owned(userId: string, id: string): LibraryDocument | null {
    return this.documents.find((document) => document.userId === userId && document.id === id) ?? null;
  }
}

/** Bytes kept in memory, addressed the same way as the disk store. */
@Injectable()
export class MemoryFileStore implements FileStore {
  readonly files = new Map<string, Buffer>();

  /** @inheritdoc */
  async write(userId: string, documentId: string, bytes: Buffer): Promise<void> {
    this.files.set(key(userId, documentId), Buffer.from(bytes));
  }

  /** @inheritdoc */
  async remove(userId: string, documentId: string): Promise<void> {
    this.files.delete(key(userId, documentId));
  }
}

function key(userId: string, documentId: string): string {
  return `${userId}/${documentId}`;
}
