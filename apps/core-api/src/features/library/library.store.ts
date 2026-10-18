import type { AuthorKind, DocumentFormat, DocumentKind, ParseStatus } from '@hira/contracts';

export const LIBRARY_STORE = Symbol('LIBRARY_STORE');
export const FILE_STORE = Symbol('FILE_STORE');
export const PDF_READER = Symbol('PDF_READER');

export interface LibraryDocument {
  id: string;
  userId: string;
  kind: DocumentKind;
  title: string;
  format: DocumentFormat;
  storagePath: string;
  contentHash: string;
  extractedText: string;
  embedding: number[] | null;
  isPinned: boolean;
  createdBy: AuthorKind;
  parseStatus: ParseStatus | null;
  createdAt: Date;
}

export interface LibraryStore {
  list(userId: string): Promise<LibraryDocument[]>;
  find(userId: string, id: string): Promise<LibraryDocument | null>;
  insert(document: LibraryDocument): Promise<LibraryDocument>;
  update(userId: string, id: string, patch: Partial<LibraryDocument>): Promise<LibraryDocument | null>;
  delete(userId: string, id: string): Promise<LibraryDocument | null>;
}

export const TEXT_EMBEDDER = Symbol('TEXT_EMBEDDER');

export interface FileStore {
  write(userId: string, documentId: string, bytes: Buffer): Promise<void>;
  remove(userId: string, documentId: string): Promise<void>;
}

export interface PdfReader {
  read(bytes: Buffer): Promise<string>;
}
