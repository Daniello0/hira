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

async function postJson(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('embed failed');
  return response.json();
}
