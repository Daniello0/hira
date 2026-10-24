import type { AuthorKind, DocumentFormat, DocumentKind, ParseStatus } from '@hira/contracts';

export const LIBRARY_STORE = Symbol('LIBRARY_STORE');
export const FILE_STORE = Symbol('FILE_STORE');
export const PDF_READER = Symbol('PDF_READER');

/** Library row without the body and the vector. Lists read only this. */
export interface LibrarySummary {
  id: string;
  userId: string;
  kind: DocumentKind;
  title: string;
  format: DocumentFormat;
  isPinned: boolean;
  createdBy: AuthorKind;
  parseStatus: ParseStatus | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryDocument extends LibrarySummary {
  storagePath: string;
  contentHash: string;
  extractedText: string;
  embedding: number[] | null;
}

export interface LibraryStore {
  /** Every file of the account, without text, oldest first. */
  list(userId: string): Promise<LibrarySummary[]>;
  /**
   * Files a turn may quote: all pinned ones plus `neighborLimit` unpinned ones,
   * nearest to `query` when it is known, otherwise the most recently updated.
   */
  forPrompt(userId: string, query: readonly number[] | null, neighborLimit: number): Promise<LibraryDocument[]>;
  find(userId: string, id: string): Promise<LibraryDocument | null>;
  insert(document: LibraryDocument): Promise<LibraryDocument>;
  update(userId: string, id: string, patch: Partial<LibraryDocument>): Promise<LibraryDocument | null>;
  delete(userId: string, id: string): Promise<LibraryDocument | null>;
}

export const TEXT_EMBEDDER = Symbol('TEXT_EMBEDDER');

export interface FileStore {
  write(userId: string, documentId: string, bytes: Buffer): Promise<void>;
  /** Removing a file that is already gone is not an error. */
  remove(userId: string, documentId: string): Promise<void>;
}

export interface PdfReader {
  read(bytes: Buffer): Promise<string>;
}
