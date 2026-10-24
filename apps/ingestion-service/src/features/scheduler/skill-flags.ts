import { readBooleanEnv } from '../../common/utils/env-flags';
import { INGESTION_ENV } from '../ingestion.constants';

/** Whether `SKILL_EXTRACTION_ENABLED` (default true) lets skill extraction call the LLM. */
export function isSkillExtractionEnabled(env: NodeJS.ProcessEnv): boolean {
  return readBooleanEnv(env, INGESTION_ENV.skillExtractionEnabled, true);
}
