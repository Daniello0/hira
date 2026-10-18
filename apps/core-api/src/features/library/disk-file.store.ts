import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ENV } from '../../common/constants/app.constants';
import type { FileStore } from './library.store';

/** Writes library bytes under LIBRARY_ROOT/{userId}/{documentId}. */
@Injectable()
export class DiskFileStore implements FileStore {
  private readonly root = libraryRoot();

  /** @inheritdoc */
  async write(userId: string, documentId: string, bytes: Buffer): Promise<void> {
    const directory = join(this.root, userId);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, documentId), bytes);
  }

  /** @inheritdoc */
  async remove(userId: string, documentId: string): Promise<void> {
    await rm(join(this.root, userId, documentId), { force: true });
  }
}

function libraryRoot(): string {
  const configured = process.env[ENV.libraryRoot]?.trim();
  if (configured === undefined || configured.length === 0) return 'storage';
  return configured;
}
