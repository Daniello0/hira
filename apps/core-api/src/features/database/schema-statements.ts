import {
  AuthorKind,
  DocumentFormat,
  DocumentKind,
  DuplicateDetection,
  EmploymentType,
  FeedbackRating,
  IngestionStatus,
  MemoryKind,
  MessageRole,
  ParseStatus,
  ProfileSkillSource,
  RateUnit,
  SeniorityLevel,
  SkillAliasSource,
  SkillEdgeType,
  SkillImportance,
  SkillLevel,
  SkillType,
  UserRole,
  VacancySource,
  VacancyStatus,
  WorkFormat,
} from '@hira/contracts';
import {
  DATABASE_TABLES,
  EMBEDDING_DIMENSION,
  HNSW_EF_CONSTRUCTION,
  HNSW_M,
  SEARCH_DOCUMENT_EXPRESSION,
} from './database.constants';

const VECTOR = `vector(${EMBEDDING_DIMENSION})`;
const TIMESTAMPS =
  'created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()';

const ENUM_TYPES: ReadonlyArray<readonly [string, Record<string, string>]> = [
  ['user_role', UserRole],
  ['seniority_level', SeniorityLevel],
  ['employment_type', EmploymentType],
  ['work_format', WorkFormat],
  ['rate_unit', RateUnit],
  ['vacancy_source', VacancySource],
  ['vacancy_status', VacancyStatus],
  ['skill_type', SkillType],
  ['skill_level', SkillLevel],
  ['profile_skill_source', ProfileSkillSource],
  ['memory_kind', MemoryKind],
  ['message_role', MessageRole],
  ['document_kind', DocumentKind],
  ['document_format', DocumentFormat],
  ['author_kind', AuthorKind],
  ['parse_status', ParseStatus],
  ['skill_edge_type', SkillEdgeType],
  ['skill_importance', SkillImportance],
  ['skill_alias_source', SkillAliasSource],
  ['duplicate_detection', DuplicateDetection],
  ['ingestion_status', IngestionStatus],
  ['feedback_rating', FeedbackRating],
];

const LOCATION_REGIONS = `('Брестская область'),
    ('Витебская область'),
    ('Гомельская область'),
    ('Гродненская область'),
    ('Минская область'),
    ('Могилёвская область'),
    ('Минск')`;

const LOCATION_CITIES = `('Брестская область', 'Брест', 52.097622, 23.734051),
    ('Витебская область', 'Витебск', 55.184806, 30.201657),
    ('Гомельская область', 'Гомель', 52.424160, 31.014281),
    ('Гродненская область', 'Гродно', 53.669353, 23.813131),
    ('Могилёвская область', 'Могилёв', 53.900716, 30.331360),
    ('Минск', 'Минск', 53.902284, 27.561831)`;

const LOCATION_SEED = `WITH regions AS (
    INSERT INTO locations (region)
    VALUES
      ${LOCATION_REGIONS}
    RETURNING id, region
  )
  INSERT INTO locations (region, city, parent_id, lat, lon)
  SELECT city.region, city.city, regions.id, city.lat, city.lon
  FROM regions
  JOIN (VALUES
    ${LOCATION_CITIES}
  ) AS city(region, city, lat, lon) ON city.region = regions.region`;

function extensionStatements(): string[] {
  return [
    'CREATE EXTENSION IF NOT EXISTS vector',
    'CREATE EXTENSION IF NOT EXISTS pg_trgm',
    'CREATE EXTENSION IF NOT EXISTS pg_textsearch',
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
  ];
}

function pgEnum(typeName: string, values: Record<string, string>): string {
  const labels = Object.values(values).map(quoteLiteral).join(', ');
  return `CREATE TYPE ${typeName} AS ENUM (${labels})`;
}

function quoteLiteral(value: string): string {
  return `'${value}'`;
}

function setUpdatedAtFunction(): string {
  return `CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$`;
}

function updatedAtTrigger(table: string): string {
  return `CREATE TRIGGER set_updated_at BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION set_updated_at()`;
}

function hnswIndex(name: string, table: string, column: string): string {
  return (
    `CREATE INDEX ${name} ON ${table} USING hnsw (${column} vector_cosine_ops) ` +
    `WITH (m = ${HNSW_M}, ef_construction = ${HNSW_EF_CONSTRUCTION})`
  );
}

function coreTables(): string[] {
  return [
    industriesTable(),
    locationsTable(),
    usersTable(),
    refreshTokensTable(),
    companiesTable(),
    vacanciesTable(),
    vacancyChunksTable(),
    vacancyDuplicatesTable(),
    skillsTable(),
    skillAliasesTable(),
    skillEdgesTable(),
    vacancySkillsTable(),
    occupationsTable(),
    occupationSkillsTable(),
  ];
}

function activityTables(): string[] {
  return [
    occupationTransitionsTable(),
    userProfilesTable(),
    userProfileSkillsTable(),
    chatsTable(),
    messagesTable(),
    userMemoriesTable(),
    userDocumentsTable(),
    messageVacanciesTable(),
    callSessionsTable(),
    callTurnsTable(),
    collectionsTable(),
    favoritesTable(),
    searchLogsTable(),
    ingestionRunsTable(),
    feedbackTable(),
  ];
}

function industriesTable(): string {
  return `CREATE TABLE industries (
    id serial PRIMARY KEY,
    name varchar(256) NOT NULL UNIQUE,
    ${TIMESTAMPS}
  )`;
}

function locationsTable(): string {
  return `CREATE TABLE locations (
    id serial PRIMARY KEY,
    region varchar(128) NOT NULL,
    city varchar(128),
    parent_id int REFERENCES locations (id) ON DELETE RESTRICT,
    lat numeric(9, 6),
    lon numeric(9, 6),
    ${TIMESTAMPS}
  )`;
}

function usersTable(): string {
  return `CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(320) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    display_name varchar(128),
    role user_role NOT NULL DEFAULT 'USER',
    email_verified_at timestamptz,
    cross_chat_memory_enabled boolean NOT NULL DEFAULT true,
    ${TIMESTAMPS},
    CONSTRAINT users_email_lowercase CHECK (email = lower(email))
  )`;
}

function refreshTokensTable(): string {
  return `CREATE TABLE refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash varchar(255) NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    user_agent varchar(512),
    ip varchar(64),
    ${TIMESTAMPS}
  )`;
}

function companiesTable(): string {
  return `CREATE TABLE companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(256) NOT NULL,
    normalized_name varchar(256) NOT NULL,
    unp varchar(32),
    website varchar(512),
    industry_id int REFERENCES industries (id) ON DELETE SET NULL,
    logo_url varchar(1024),
    description text,
    ${TIMESTAMPS}
  )`;
}

const VACANCY_LEAD_COLUMNS = `id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source vacancy_source NOT NULL,
    language char(2) NOT NULL,
    external_id varchar(128) NOT NULL,
    url varchar(2048),
    title varchar(512) NOT NULL,
    company_id uuid REFERENCES companies (id) ON DELETE SET NULL,
    location_id int REFERENCES locations (id) ON DELETE RESTRICT,
    description text,
    description_raw text,
    seniority seniority_level,
    employment employment_type,
    work_format work_format,
    schedule varchar(128)`;

const VACANCY_PAY_COLUMNS = `salary_min numeric(12, 2),
    salary_max numeric(12, 2),
    salary_currency char(3),
    salary_min_byn numeric(12, 2),
    salary_max_byn numeric(12, 2),
    is_gross boolean,
    rate_amount numeric(12, 2),
    rate_unit rate_unit,
    project_duration_days int,
    is_foreign_remote boolean NOT NULL DEFAULT false,
    status vacancy_status NOT NULL`;

const VACANCY_TAIL_COLUMNS = `published_at timestamptz,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    content_hash char(64),
    skills_text text NOT NULL DEFAULT '',
    company_name text NOT NULL DEFAULT '',
    skills_extracted_at timestamptz,
    embedding ${VECTOR},
    search_document text GENERATED ALWAYS AS (${SEARCH_DOCUMENT_EXPRESSION}) STORED,
    ${TIMESTAMPS},
    UNIQUE (source, external_id),
    CONSTRAINT vacancies_language_known CHECK (language IN ('ru', 'en'))`;

function vacanciesTable(): string {
  return `CREATE TABLE vacancies (
    ${VACANCY_LEAD_COLUMNS},
    ${VACANCY_PAY_COLUMNS},
    ${VACANCY_TAIL_COLUMNS}
  )`;
}

function vacancyChunksTable(): string {
  return `CREATE TABLE vacancy_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vacancy_id uuid NOT NULL REFERENCES vacancies (id) ON DELETE CASCADE,
    chunk_index int NOT NULL,
    content text NOT NULL,
    embedding ${VECTOR},
    token_count int NOT NULL,
    ${TIMESTAMPS},
    UNIQUE (vacancy_id, chunk_index)
  )`;
}

function vacancyDuplicatesTable(): string {
  return `CREATE TABLE vacancy_duplicates (
    canonical_vacancy_id uuid NOT NULL REFERENCES vacancies (id) ON DELETE CASCADE,
    duplicate_vacancy_id uuid NOT NULL REFERENCES vacancies (id) ON DELETE CASCADE,
    similarity real NOT NULL,
    detected_by duplicate_detection NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (canonical_vacancy_id, duplicate_vacancy_id),
    CONSTRAINT vacancy_duplicates_similarity_range CHECK (similarity >= 0 AND similarity <= 1),
    CONSTRAINT vacancy_duplicates_distinct CHECK (canonical_vacancy_id <> duplicate_vacancy_id)
  )`;
}

function skillsTable(): string {
  return `CREATE TABLE skills (
    id serial PRIMARY KEY,
    canonical_name varchar(256) NOT NULL UNIQUE,
    skill_type skill_type NOT NULL,
    esco_uri varchar(256),
    description text,
    embedding ${VECTOR},
    idf real NOT NULL DEFAULT 0,
    vacancy_count int NOT NULL DEFAULT 0,
    needs_review boolean NOT NULL DEFAULT false,
    ${TIMESTAMPS}
  )`;
}

function skillAliasesTable(): string {
  return `CREATE TABLE skill_aliases (
    id serial PRIMARY KEY,
    skill_id int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
    alias varchar(256) NOT NULL,
    lang char(2) NOT NULL,
    source skill_alias_source NOT NULL,
    ${TIMESTAMPS},
    UNIQUE (alias, lang),
    CONSTRAINT skill_aliases_lang_known CHECK (lang IN ('ru', 'en'))
  )`;
}

function skillEdgesTable(): string {
  return `CREATE TABLE skill_edges (
    source_skill_id int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
    target_skill_id int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
    edge_type skill_edge_type NOT NULL,
    weight real NOT NULL,
    evidence varchar(64) NOT NULL,
    ${TIMESTAMPS},
    PRIMARY KEY (source_skill_id, target_skill_id, edge_type),
    CONSTRAINT skill_edges_weight_range CHECK (weight >= 0 AND weight <= 1),
    CONSTRAINT skill_edges_evidence_known CHECK (evidence IN ('TAXONOMY', 'COOCCURRENCE', 'LLM')),
    CONSTRAINT skill_edges_distinct CHECK (source_skill_id <> target_skill_id)
  )`;
}

function vacancySkillsTable(): string {
  return `CREATE TABLE vacancy_skills (
    vacancy_id uuid NOT NULL REFERENCES vacancies (id) ON DELETE CASCADE,
    skill_id int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
    importance skill_importance NOT NULL,
    weight real NOT NULL,
    evidence_span text,
    ${TIMESTAMPS},
    PRIMARY KEY (vacancy_id, skill_id),
    CONSTRAINT vacancy_skills_weight_range CHECK (weight >= 0 AND weight <= 1)
  )`;
}

function occupationsTable(): string {
  return `CREATE TABLE occupations (
    id serial PRIMARY KEY,
    canonical_name varchar(256) NOT NULL UNIQUE,
    esco_uri varchar(256),
    embedding ${VECTOR},
    description text,
    ${TIMESTAMPS}
  )`;
}

function occupationSkillsTable(): string {
  return `CREATE TABLE occupation_skills (
    occupation_id int NOT NULL REFERENCES occupations (id) ON DELETE CASCADE,
    skill_id int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
    typicality real NOT NULL,
    ${TIMESTAMPS},
    PRIMARY KEY (occupation_id, skill_id),
    CONSTRAINT occupation_skills_typicality_range CHECK (typicality >= 0 AND typicality <= 1)
  )`;
}

function occupationTransitionsTable(): string {
  return `CREATE TABLE occupation_transitions (
    from_occupation_id int NOT NULL REFERENCES occupations (id) ON DELETE CASCADE,
    to_occupation_id int NOT NULL REFERENCES occupations (id) ON DELETE CASCADE,
    frequency int NOT NULL DEFAULT 0,
    skill_gap int[] NOT NULL DEFAULT '{}',
    ${TIMESTAMPS},
    PRIMARY KEY (from_occupation_id, to_occupation_id),
    CONSTRAINT occupation_transitions_distinct CHECK (from_occupation_id <> to_occupation_id)
  )`;
}

function userProfilesTable(): string {
  return `CREATE TABLE user_profiles (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    headline varchar(256),
    about text,
    seniority seniority_level,
    desired_roles text[] NOT NULL DEFAULT '{}',
    preferred_work_format work_format[] NOT NULL DEFAULT '{}',
    preferred_employment employment_type[] NOT NULL DEFAULT '{}',
    preferred_locations int[] NOT NULL DEFAULT '{}',
    salary_expectation_min numeric(12, 2),
    currency char(3),
    education text,
    profile_embedding ${VECTOR},
    ${TIMESTAMPS}
  )`;
}

function userProfileSkillsTable(): string {
  return `CREATE TABLE user_profile_skills (
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    skill_id int NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
    level skill_level NOT NULL,
    years int,
    source profile_skill_source NOT NULL,
    confidence real NOT NULL,
    ${TIMESTAMPS},
    PRIMARY KEY (user_id, skill_id),
    CONSTRAINT user_profile_skills_confidence_range CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT user_profile_skills_years_non_negative CHECK (years IS NULL OR years >= 0)
  )`;
}

function chatsTable(): string {
  return `CREATE TABLE chats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title varchar(256),
    summary text,
    summary_updated_at timestamptz,
    message_count int NOT NULL DEFAULT 0,
    is_archived boolean NOT NULL DEFAULT false,
    ${TIMESTAMPS}
  )`;
}

function messagesTable(): string {
  return `CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id uuid NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
    role message_role NOT NULL,
    content text NOT NULL,
    intent jsonb,
    diagnostics jsonb,
    token_usage jsonb,
    ${TIMESTAMPS}
  )`;
}

function userMemoriesTable(): string {
  return `CREATE TABLE user_memories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind memory_kind NOT NULL,
    content text NOT NULL,
    embedding ${VECTOR},
    confidence real NOT NULL,
    source_message_id uuid REFERENCES messages (id) ON DELETE SET NULL,
    is_pinned boolean NOT NULL DEFAULT false,
    expires_at timestamptz,
    revoked_at timestamptz,
    ${TIMESTAMPS},
    CONSTRAINT user_memories_confidence_range CHECK (confidence >= 0 AND confidence <= 1)
  )`;
}

const DOCUMENT_FORMAT_CHECK = `(kind = 'RESUME' AND format = 'PDF') OR (kind <> 'RESUME' AND format IN ('MD', 'TXT'))`;

function userDocumentsTable(): string {
  return `CREATE TABLE user_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind document_kind NOT NULL,
    title varchar(256) NOT NULL,
    format document_format NOT NULL,
    storage_path varchar(1024) NOT NULL,
    content_hash char(64) NOT NULL,
    extracted_text text NOT NULL,
    embedding ${VECTOR},
    is_pinned boolean NOT NULL DEFAULT false,
    created_by author_kind NOT NULL,
    parse_status parse_status,
    ${TIMESTAMPS},
    CONSTRAINT user_documents_format_matches_kind CHECK (${DOCUMENT_FORMAT_CHECK})
  )`;
}

function messageVacanciesTable(): string {
  return `CREATE TABLE message_vacancies (
    message_id uuid NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    vacancy_id uuid NOT NULL REFERENCES vacancies (id) ON DELETE CASCADE,
    rank int NOT NULL,
    score real NOT NULL,
    explanation jsonb NOT NULL,
    retrieved_by text[] NOT NULL,
    ${TIMESTAMPS},
    PRIMARY KEY (message_id, vacancy_id)
  )`;
}

function callSessionsTable(): string {
  return `CREATE TABLE call_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    started_at timestamptz NOT NULL,
    ended_at timestamptz,
    ${TIMESTAMPS}
  )`;
}

function callTurnsTable(): string {
  return `CREATE TABLE call_turns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES call_sessions (id) ON DELETE CASCADE,
    role author_kind NOT NULL,
    content text NOT NULL,
    results jsonb,
    ${TIMESTAMPS}
  )`;
}

const FAVORITE_COLLECTION_FK =
  'CONSTRAINT favorites_collection_same_user FOREIGN KEY (collection_id, user_id) ' +
  'REFERENCES collections (id, user_id) ON DELETE SET NULL (collection_id)';

function collectionsTable(): string {
  return `CREATE TABLE collections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name varchar(128) NOT NULL,
    description text,
    is_default boolean NOT NULL DEFAULT false,
    ${TIMESTAMPS},
    UNIQUE (id, user_id)
  )`;
}

function favoritesTable(): string {
  return `CREATE TABLE favorites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    vacancy_id uuid NOT NULL REFERENCES vacancies (id) ON DELETE CASCADE,
    collection_id uuid,
    note text,
    added_by author_kind NOT NULL,
    ${TIMESTAMPS},
    UNIQUE (user_id, vacancy_id),
    ${FAVORITE_COLLECTION_FK}
  )`;
}

function searchLogsTable(): string {
  return `CREATE TABLE search_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users (id) ON DELETE SET NULL,
    message_id uuid REFERENCES messages (id) ON DELETE SET NULL,
    raw_query text NOT NULL,
    intent jsonb,
    branch_timings jsonb,
    candidate_counts jsonb,
    total_latency_ms int,
    rerank_applied boolean NOT NULL DEFAULT false,
    relaxation_steps jsonb,
    ${TIMESTAMPS}
  )`;
}

function ingestionRunsTable(): string {
  return `CREATE TABLE ingestion_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source vacancy_source NOT NULL,
    job_type varchar(64) NOT NULL,
    started_at timestamptz NOT NULL,
    finished_at timestamptz,
    status ingestion_status NOT NULL,
    fetched int NOT NULL DEFAULT 0,
    created int NOT NULL DEFAULT 0,
    updated int NOT NULL DEFAULT 0,
    skipped int NOT NULL DEFAULT 0,
    failed int NOT NULL DEFAULT 0,
    errors jsonb,
    ${TIMESTAMPS}
  )`;
}

function feedbackTable(): string {
  return `CREATE TABLE feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message_id uuid NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    vacancy_id uuid REFERENCES vacancies (id) ON DELETE SET NULL,
    rating feedback_rating NOT NULL,
    comment text,
    ${TIMESTAMPS}
  )`;
}

function indexStatements(): string[] {
  return [...searchIndexes(), ...lookupIndexes()];
}

function searchIndexes(): string[] {
  return [
    "CREATE UNIQUE INDEX uq_locations_region_city ON locations (region, (COALESCE(city, '')))",
    `CREATE INDEX idx_vac_bm25_ru ON vacancies USING bm25 (search_document) WITH (text_config = 'russian') WHERE language = 'ru'`,
    `CREATE INDEX idx_vac_bm25_en ON vacancies USING bm25 (search_document) WITH (text_config = 'english') WHERE language = 'en'`,
    hnswIndex('idx_vac_emb_hnsw', 'vacancies', 'embedding'),
    hnswIndex('idx_vac_chunk_emb_hnsw', 'vacancy_chunks', 'embedding'),
    hnswIndex('idx_skills_emb_hnsw', 'skills', 'embedding'),
    hnswIndex('idx_occupations_emb_hnsw', 'occupations', 'embedding'),
    hnswIndex('idx_user_profiles_emb_hnsw', 'user_profiles', 'profile_embedding'),
    hnswIndex('idx_user_memories_emb_hnsw', 'user_memories', 'embedding'),
    hnswIndex('idx_user_documents_emb_hnsw', 'user_documents', 'embedding'),
  ];
}

function lookupIndexes(): string[] {
  return [
    'CREATE INDEX idx_vac_status_seen ON vacancies (status, last_seen_at DESC)',
    'CREATE INDEX idx_vac_filters ON vacancies (status, seniority, work_format, employment)',
    'CREATE INDEX idx_vac_title_trgm ON vacancies USING gin (title gin_trgm_ops)',
    'CREATE INDEX idx_company_name_trgm ON companies USING gin (normalized_name gin_trgm_ops)',
    'CREATE INDEX idx_skill_alias_trgm ON skill_aliases USING gin (alias gin_trgm_ops)',
    'CREATE INDEX idx_skill_edges_target ON skill_edges (target_skill_id)',
    'CREATE INDEX idx_vacancy_skills_skill ON vacancy_skills (skill_id)',
    'CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id)',
    'CREATE INDEX idx_chats_user ON chats (user_id)',
    'CREATE INDEX idx_messages_chat ON messages (chat_id)',
  ];
}

/** Statements that create the schema. Each entry is one command. */
export const INITIAL_SCHEMA_UP: readonly string[] = [
  ...extensionStatements(),
  ...ENUM_TYPES.map(([name, values]) => pgEnum(name, values)),
  setUpdatedAtFunction(),
  ...coreTables(),
  ...activityTables(),
  ...indexStatements(),
  ...DATABASE_TABLES.map(updatedAtTrigger),
  LOCATION_SEED,
];

/** Drops the schema. Extensions stay installed. */
export const INITIAL_SCHEMA_DOWN: readonly string[] = [
  `DROP TABLE IF EXISTS ${[...DATABASE_TABLES].reverse().join(', ')} CASCADE`,
  `DROP TYPE IF EXISTS ${ENUM_TYPES.map(([name]) => name).join(', ')}`,
  'DROP FUNCTION IF EXISTS set_updated_at()',
];
