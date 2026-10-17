import { SkillImportance, SkillType } from '@hira/contracts';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app';
import { LlmRouteError } from '../llm/llm.errors';
import {
  LLM_INVALID_OUTPUT_CODE,
  LLM_INVALID_OUTPUT_MESSAGE,
  LLM_INVALID_OUTPUT_STATUS,
} from '../llm/llm.constants';
import { createLlmRouter, type LlmRouterDeps } from '../llm/llm.router';

const logger = pino({ level: 'silent' });
const body = {
  vacancies: [{ id: 'v1', title: 'Backend', description: 'нужен Python' }],
};

describe('extract-skills route', () => {
  it('returns 503 when the model is not configured', async () => {
    const extractSkills = vi.fn();
    const response = await request(appOf({ ...deps(), apiKey: '', extractSkills }))
      .post('/internal/v1/extract-skills')
      .set('X-Internal-Token', 'secret')
      .send(body);
    expect(response.status).toBe(503);
    expect(response.body.errorCode).toBe('LLM_NOT_CONFIGURED');
    expect(extractSkills).not.toHaveBeenCalled();
  });

  it('returns 400 for an empty vacancy list and reports the request id', async () => {
    const response = await request(appOf(deps()))
      .post('/internal/v1/extract-skills')
      .set('X-Internal-Token', 'secret')
      .set('X-Request-Id', 'req-8')
      .send({ vacancies: [] });
    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_FAILED');
    expect(response.body.requestId).toBe('req-8');
  });

  it('returns extracted skills and the provider header', async () => {
    const extractSkills = vi.fn().mockResolvedValue({
      results: [
        {
          id: 'v1',
          skills: [
            {
              surface: 'Python',
              skillType: SkillType.Hard,
              importance: SkillImportance.Required,
              evidenceSpan: 'Python',
              weight: 1,
            },
          ],
        },
      ],
    });
    const response = await request(appOf({ ...deps(), extractSkills }))
      .post('/internal/v1/extract-skills')
      .set('X-Internal-Token', 'secret')
      .send(body);
    expect(response.status).toBe(200);
    expect(response.headers['x-llm-provider']).toBe('openrouter');
    expect(response.body.results[0].skills[0].surface).toBe('Python');
  });

  it('returns 422 when extraction fails validation', async () => {
    const extractSkills = vi
      .fn()
      .mockRejectedValue(
        new LlmRouteError(
          LLM_INVALID_OUTPUT_STATUS,
          LLM_INVALID_OUTPUT_CODE,
          LLM_INVALID_OUTPUT_MESSAGE,
        ),
      );
    const response = await request(appOf({ ...deps(), extractSkills }))
      .post('/internal/v1/extract-skills')
      .set('X-Internal-Token', 'secret')
      .send(body);
    expect(response.status).toBe(422);
    expect(response.body.errorCode).toBe('LLM_INVALID_OUTPUT');
    expect(response.headers['x-llm-provider']).toBe('openrouter');
  });
});

function appOf(routerDeps: LlmRouterDeps) {
  return createApp({
    logger,
    internalToken: 'secret',
    probes: [],
    internalRouter: createLlmRouter(routerDeps),
  });
}

function deps(): LlmRouterDeps {
  return {
    apiKey: 'sk-test',
    model: 'test-model',
    understand: vi.fn(),
    generate: vi.fn(),
    extractSkills: vi.fn(),
  };
}
