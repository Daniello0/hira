import { Module } from '@nestjs/common';
import { ENV } from '../../common/constants/app.constants';
import { TEXT_EMBEDDER } from '../library/library.store';
import { embedText } from './tei-embed';

/** TEI client for memory and library vectors. An empty URL yields null vectors. */
@Module({
  providers: [
    {
      provide: TEXT_EMBEDDER,
      useFactory: () => {
        const baseUrl = process.env[ENV.teiEmbedUrl]?.trim() ?? '';
        return (text: string) => embedText({ post: postJson }, baseUrl, text);
      },
    },
  ],
  exports: [TEXT_EMBEDDER],
})
export class EmbedModule {}

/**
 * One short text takes TEI well under a second. A busy or warming TEI must not hold a chat turn:
 * past this the vector is null and the turn goes on without it.
 */
const EMBED_TIMEOUT_MS = 3_000;

async function postJson(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error('embed failed');
  return response.json();
}
