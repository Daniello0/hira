import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { createDataSource } from './data-source';
import { readDatabaseUrl } from './database.config';
import {
  DATABASE_TABLES,
  EMBEDDING_DIMENSION,
  HNSW_EF_CONSTRUCTION,
  HNSW_M,
  SEARCH_DOCUMENT_EXPRESSION,
} from './database.constants';
import { INITIAL_SCHEMA_UP } from './schema-statements';

const EXPECTED_TABLES = [
  'call_sessions',
  'call_turns',
  'chats',
  'collections',
  'companies',
  'favorites',
  'feedback',
  'industries',
  'ingestion_runs',
  'locations',
  'message_vacancies',
  'messages',
  'occupation_skills',
  'occupation_transitions',
  'occupations',
  'refresh_tokens',
  'search_logs',
  'skill_aliases',
  'skill_edges',
  'skills',
  'user_documents',
  'user_memories',
  'user_profile_skills',
  'user_profiles',
  'users',
  'vacancies',
  'vacancy_chunks',
  'vacancy_duplicates',
  'vacancy_skills',
];

describe('schema constants', () => {
  it('keeps the embedding size and HNSW build parameters from the data model', () => {
    expect(EMBEDDING_DIMENSION).toBe(1024);
    expect(HNSW_M).toBe(16);
    expect(HNSW_EF_CONSTRUCTION).toBe(64);
  });

  it('lists every table once', () => {
    expect([...DATABASE_TABLES].sort()).toEqual([...EXPECTED_TABLES].sort());
  });

  it('builds the lexical document from row-local text and not a tsvector', () => {
    expect(SEARCH_DOCUMENT_EXPRESSION).toContain('title');
    expect(SEARCH_DOCUMENT_EXPRESSION).toContain('skills_text');
    expect(SEARCH_DOCUMENT_EXPRESSION).toContain('company_name');
    expect(SEARCH_DOCUMENT_EXPRESSION).toContain('description');
    expect(SEARCH_DOCUMENT_EXPRESSION).not.toContain('to_tsvector');
    expect(SEARCH_DOCUMENT_EXPRESSION).not.toContain('setweight');
  });

  it('ties a favorite collection to the same user', () => {
    const sql = INITIAL_SCHEMA_UP.join('\n');
    expect(sql).toContain('UNIQUE (id, user_id)');
    expect(sql).toContain('favorites_collection_same_user');
    expect(sql).toContain('ON DELETE SET NULL (collection_id)');
  });

  it('creates extensions, partial BM25 indexes, HNSW, and trigram indexes in SQL', () => {
    const sql = INITIAL_SCHEMA_UP.join('\n');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pg_textsearch');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    expect(sql).toContain('idx_vac_bm25_ru');
    expect(sql).toContain("text_config = 'russian'");
    expect(sql).toContain("WHERE language = 'ru'");
    expect(sql).toContain('idx_vac_bm25_en');
    expect(sql).toContain("text_config = 'english'");
    expect(sql).toContain("WHERE language = 'en'");
    expect(sql).toContain('vector_cosine_ops');
    expect(sql).toContain(`m = ${HNSW_M}`);
    expect(sql).toContain(`ef_construction = ${HNSW_EF_CONSTRUCTION}`);
    expect(sql).toContain('gin_trgm_ops');
    expect(sql).not.toContain('search_vector');
  });
});

describe('database url', () => {
  it('rejects a missing or blank DATABASE_URL', () => {
    expect(() => readDatabaseUrl({})).toThrow(/DATABASE_URL/);
    expect(() => readDatabaseUrl({ DATABASE_URL: '   ' })).toThrow(/DATABASE_URL/);
  });
});

describe('data source', () => {
  it('does not synchronize and registers the schema entities', async () => {
    const source = createDataSource('postgresql://hira:hira@127.0.0.1:1/unused');
    expect(source.options.type).toBe('postgres');
    expect(source.options.synchronize).toBe(false);
    await source.buildMetadatas();
    const names = source.entityMetadatas.map((metadata) => metadata.tableName);
    expect(names.sort()).toEqual([...EXPECTED_TABLES].sort());
    const vacancies = source.getMetadata('vacancies');
    const document = vacancies.columns.find((column) => column.databaseName === 'search_document');
    expect(document?.generatedType).toBe('STORED');
    expect(document?.asExpression).toBe(SEARCH_DOCUMENT_EXPRESSION);
    const embedding = vacancies.columns.find((column) => column.databaseName === 'embedding');
    expect(embedding?.length).toBe(String(EMBEDDING_DIMENSION));
  });
});
