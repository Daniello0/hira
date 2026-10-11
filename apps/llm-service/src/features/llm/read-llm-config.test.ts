import { describe, expect, it } from 'vitest';
import { readLlmConfig } from './read-llm-config';

describe('readLlmConfig', () => {
  it('trims the key and model and defaults the base url', () => {
    expect(
      readLlmConfig({
        OPENROUTER_API_KEY: '  sk-test  ',
        OPENROUTER_MODEL: '  test-model ',
      }),
    ).toEqual({
      apiKey: 'sk-test',
      model: 'test-model',
      baseUrl: 'https://openrouter.ai/api/v1',
    });
  });

  it('keeps an empty key and honors a configured base url', () => {
    expect(
      readLlmConfig({
        OPENROUTER_BASE_URL: ' http://127.0.0.1:9/v1/ ',
      }),
    ).toEqual({
      apiKey: '',
      model: '',
      baseUrl: 'http://127.0.0.1:9/v1',
    });
  });
});
