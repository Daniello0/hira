import { VacancySource } from '@hira/contracts';

export const STALE_THRESHOLD_HOURS = 48;
export const SIMHASH_BITS = 64;
export const SIMHASH_MAX_DISTANCE = 3;
export const SIMHASH_HEX_LENGTH = 16;
export const HOUR_MS = 60 * 60 * 1000;
export const SOURCE_PAUSE_MS = 2000;
export const LIVENESS_BATCH_SIZE = 20;
export const DEV_VACANCY_LIMIT = 2000;
export const QUEUE_PREFIX = 'bull:ingestion';
export const INGEST_QUEUE = 'ingest';
export const JOB_INCREMENTAL = 'INCREMENTAL';
export const JOB_LIVENESS = 'LIVENESS';
export const JOB_EXTRACT_SKILLS = 'EXTRACT_SKILLS';
export const JOB_EMBED = 'EMBED';
export const JOB_GRAPH = 'GRAPH';
/** Weekly deeper crawl that catches what the capped incremental runs missed. */
export const JOB_RECONCILE = 'RECONCILE';
export const EXTRACT_SKILLS_QUEUE = 'extract-skills';
export const EMBED_QUEUE = 'embed';
export const GRAPH_QUEUE = 'graph';
export const DUPLICATE_COSINE_THRESHOLD = 0.93;
export const TRIGRAM_MATCH_THRESHOLD = 0.8;
export const VECTOR_MATCH_THRESHOLD = 0.85;
export const VALIDATION_FAILED_CODE = 'VALIDATION_FAILED';
export const VALIDATION_FAILED_MESSAGE = 'Run request is invalid';
export const HH_USER_AGENT = 'HiraVacancyAggregator/0.1 (course project)';
export const NBRB_RATES_URL = 'https://api.nbrb.by/exrates/rates?periodicity=0';
export const RATE_TIME_ZONE = 'Europe/Minsk';

export const STAGE_SOURCES = [
  VacancySource.RabotaBy,
  VacancySource.Gsz,
  VacancySource.HabrCareer,
  VacancySource.PracaBy,
  VacancySource.LinkedIn,
  VacancySource.Indeed,
] as const;

export const JOB_TYPES = [
  JOB_INCREMENTAL,
  JOB_LIVENESS,
  JOB_EXTRACT_SKILLS,
  JOB_EMBED,
  JOB_GRAPH,
  JOB_RECONCILE,
] as const;

/** Jobs that download pages from the source and therefore need it enabled. */
export const SOURCE_JOB_TYPES = [JOB_INCREMENTAL, JOB_LIVENESS, JOB_RECONCILE] as const;

export const SIX_HOURLY_CRON = '0 */6 * * *';
export const NIGHTLY_COLLECT_CRON = '0 2 * * *';
export const LIVENESS_CRON = '0 3 * * *';
export const RECONCILE_CRON = '0 5 * * 0';
/** A reconciliation run reads this many times the usual `INGEST_LIMIT`. */
export const RECONCILE_LIMIT_FACTOR = 5;
/** Prefix of fixed BullMQ job ids for cron ticks. BullMQ forbids ':' in custom ids. */
export const CRON_JOB_ID_PREFIX = 'cron';

/** Upper bound on list pages read per query, whatever `INGEST_LIMIT` says. */
export const MAX_LIST_PAGES = 50;
/** Share of Cyrillic letters from which a vacancy is stored as Russian. */
export const CYRILLIC_RU_SHARE = 0.3;
export const BELARUS_COUNTRY_CODE = 'BY';

/** Vacancies sent to llm-service in one extract-skills call. */
export const SKILL_BATCH_SIZE = 5;
/** After this many failed extractions a vacancy is no longer claimed. */
export const SKILL_MAX_FAILURES = 3;
export const DEFAULT_LLM_DAILY_BUDGET = 200;
export const LLM_BUDGET_KEY = 'llm-extract-skills';
export const BUDGET_KEY_PREFIX = 'hira:ingestion:budget';
export const BUDGET_TTL_SECONDS = 2 * 24 * 60 * 60;
export const HTTP_TOO_MANY_REQUESTS = 429;

/** Environment switches owned by ingestion-service. */
export const INGESTION_ENV = {
  skillExtractionEnabled: 'SKILL_EXTRACTION_ENABLED',
  llmDailyBudget: 'LLM_DAILY_BUDGET',
} as const;
