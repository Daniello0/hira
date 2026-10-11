import { ENV } from '../../common/constants/app.constants';
import { DEFAULT_OPENROUTER_BASE_URL } from './llm.constants';

export interface LlmConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

/** Reads the OpenRouter settings. An empty key or model is left empty for the route to reject. */
export function readLlmConfig(env: NodeJS.ProcessEnv): LlmConfig {
  return {
    apiKey: readTrimmed(env, ENV.openRouterApiKey),
    model: readTrimmed(env, ENV.openRouterModel),
    baseUrl: readBaseUrl(env),
  };
}

function readBaseUrl(env: NodeJS.ProcessEnv): string {
  const configured = readTrimmed(env, ENV.openRouterBaseUrl).replace(/\/+$/, '');
  if (configured.length === 0) return DEFAULT_OPENROUTER_BASE_URL;
  return configured;
}

function readTrimmed(env: NodeJS.ProcessEnv, name: string): string {
  return env[name]?.trim() ?? '';
}
