import { Injectable, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { EmbedModule } from '../embed/embed.module';
import { DiskFileStore } from './disk-file.store';
import { LibraryService, TypeOrmLibraryStore } from './library.service';
import { FILE_STORE, LIBRARY_STORE, PDF_READER, type PdfReader } from './library.store';
import { readPdfText } from './read-pdf-text';

/** Reads PDF bytes with unpdf. */
@Injectable()
export class UnpdfReader implements PdfReader {
  /** @inheritdoc */
  read(bytes: Buffer): Promise<string> {
    return readPdfText(bytes);
  }
}

/** Personal files on disk and in PostgreSQL. */
@Module({
  imports: [AuthModule, ChatModule, EmbedModule],
  providers: [
    LibraryService,
    TypeOrmLibraryStore,
    DiskFileStore,
    UnpdfReader,
    { provide: LIBRARY_STORE, useExisting: TypeOrmLibraryStore },
    { provide: FILE_STORE, useExisting: DiskFileStore },
    { provide: PDF_READER, useExisting: UnpdfReader },
  ],
  exports: [LibraryService, LIBRARY_STORE, FILE_STORE, PDF_READER],
})
export class LibraryModule {}
