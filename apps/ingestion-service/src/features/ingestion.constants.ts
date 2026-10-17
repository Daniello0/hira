import { VacancySource } from '@hira/contracts';

export const STALE_THRESHOLD_HOURS = 48;
export const SIMHASH_BITS = 64;
export const SIMHASH_MAX_DISTANCE = 3;
export const SIMHASH_HEX_LENGTH = 16;
export const HOUR_MS = 60 * 60 * 1000;
export const SOURCE_PAUSE_MS = 2000;
export const DEV_VACANCY_LIMIT = 2000;
export const QUEUE_PREFIX = 'bull:ingestion';
export const INGEST_QUEUE = 'ingest';
export const JOB_INCREMENTAL = 'INCREMENTAL';
export const JOB_LIVENESS = 'LIVENESS';
export const VALIDATION_FAILED_CODE = 'VALIDATION_FAILED';
export const VALIDATION_FAILED_MESSAGE = 'Run request is invalid';
export const HH_USER_AGENT = 'HiraVacancyAggregator/0.1 (course project)';
export const NBRB_RATES_URL = 'https://api.nbrb.by/exrates/rates?periodicity=0';
export const RATE_TIME_ZONE = 'Europe/Minsk';

export const STAGE_SOURCES = [
  VacancySource.RabotaBy,
  VacancySource.Gsz,
  VacancySource.HabrCareer,
] as const;

export const JOB_TYPES = [JOB_INCREMENTAL, JOB_LIVENESS] as const;
