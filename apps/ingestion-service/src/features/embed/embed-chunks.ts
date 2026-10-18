import type { VacancySource } from '@hira/contracts';
import { chunkItems, requestEmbeddings, vectorLiteral, type EmbedPost } from './embed-client';
import { EMBED_CLAIM_LIMIT } from './pending-kind';
import { splitDescription, type DescriptionChunk } from './split-description';
import type { SqlClient } from '../store/sql-client';

export interface ChunkEmbedResult {
  updated: number;
  failed: number;
  errors: Array<{ message: string }>;
}

interface PreparedChunks {
  id: string;
  chunks: DescriptionChunk[];
}

/** Embeds description chunks that are missing or still have an empty vector. */
export async function embedPendingChunks(
  client: SqlClient,
  source: VacancySource,
  baseUrl: string,
  post: EmbedPost,
): Promise<ChunkEmbedResult> {
  try {
    const prepared = await prepare(client, source);
    const vectors = await embedAll(baseUrl, post, textsOf(prepared));
    await writeAll(client, prepared, vectors);
    return { updated: prepared.length, failed: 0, errors: [] };
  } catch (error) {
    return { updated: 0, failed: 1, errors: [{ message: errorText(error) }] };
  }
}

async function prepare(client: SqlClient, source: VacancySource): Promise<PreparedChunks[]> {
  const result = await client.query(PENDING_CHUNKS, [source, EMBED_CLAIM_LIMIT]);
  return result.rows.map((row) => ({
    id: String(row.id),
    chunks: splitDescription(row.description == null ? null : String(row.description)),
  }));
}

async function embedAll(baseUrl: string, post: EmbedPost, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const vectors: number[][] = [];
  for (const batch of chunkItems(texts, EMBED_CLAIM_LIMIT)) {
    vectors.push(...(await requestEmbeddings(post, baseUrl, batch)));
  }
  return vectors;
}

async function writeAll(client: SqlClient, prepared: PreparedChunks[], vectors: number[][]): Promise<void> {
  let offset = 0;
  for (const item of prepared) {
    const slice = vectors.slice(offset, offset + item.chunks.length);
    offset += item.chunks.length;
    if (item.chunks.length === 0) continue;
    await replaceChunks(client, item.id, item.chunks, slice);
  }
}

async function replaceChunks(
  client: SqlClient,
  vacancyId: string,
  chunks: DescriptionChunk[],
  vectors: number[][],
): Promise<void> {
  if (vectors.length !== chunks.length) throw new Error('embed batch length mismatch');
  await client.query('BEGIN');
  try {
    await client.query(`DELETE FROM vacancy_chunks WHERE vacancy_id = $1`, [vacancyId]);
    for (let index = 0; index < chunks.length; index += 1) {
      await insertChunk(client, vacancyId, chunks[index] as DescriptionChunk, vectors[index] as number[]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function insertChunk(
  client: SqlClient,
  vacancyId: string,
  chunk: DescriptionChunk,
  vector: number[],
): Promise<void> {
  await client.query(
    `INSERT INTO vacancy_chunks (vacancy_id, chunk_index, content, token_count, embedding)
     VALUES ($1, $2, $3, $4, $5::vector)`,
    [vacancyId, chunk.chunkIndex, chunk.content, chunk.tokenCount, vectorLiteral(vector)],
  );
}

function textsOf(prepared: readonly PreparedChunks[]): string[] {
  return prepared.flatMap((item) => item.chunks.map((chunk) => chunk.content));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'embed failed';
}

const PENDING_CHUNKS = `SELECT v.id::text AS id, v.description
  FROM vacancies v
  WHERE v.source = $1
    AND v.description IS NOT NULL
    AND btrim(v.description) <> ''
    AND (
      NOT EXISTS (SELECT 1 FROM vacancy_chunks c WHERE c.vacancy_id = v.id)
      OR EXISTS (
        SELECT 1 FROM vacancy_chunks c
        WHERE c.vacancy_id = v.id AND c.embedding IS NULL
      )
    )
  ORDER BY v.id
  LIMIT $2`;
