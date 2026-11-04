import { Injectable, Module } from '@nestjs/common';
import { ENV } from '../../common/constants/app.constants';
import { DEFAULT_LLM_URL } from '../search-orchestrator/search.constants';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { EmbedModule } from '../embed/embed.module';
import { DiskFileStore } from './disk-file.store';
import { LibraryService } from './library.service';
import { TypeOrmLibraryStore } from './typeorm-library.store';
import { FILE_STORE, LIBRARY_STORE, PDF_READER, type PdfReader } from './library.store';
import { readPdfText } from './read-pdf-text';
import { IMAGE_READER, createImageReader } from './image-reader';

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
    {
      provide: IMAGE_READER,
      useFactory: () =>
        createImageReader({ baseUrl: process.env[ENV.llmServiceUrl]?.trim() || DEFAULT_LLM_URL, token: process.env[ENV.internalToken]?.trim() ?? '' }),
    },
  ],
  exports: [LibraryService, LIBRARY_STORE, FILE_STORE, PDF_READER, IMAGE_READER],
})
export class LibraryModule {}
