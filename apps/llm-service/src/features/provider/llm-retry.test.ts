import { describe, expect, it, vi } from 'vitest';
import { LlmOutputError, LlmRouteError, ProviderTransportError } from '../llm/llm.errors';
import { classifyLlmFailure, runLlmAttempts } from './llm-retry';
import { nextAttemptTimeout } from '../llm/attempt-timeout';

describe('classifyLlmFailure', () => {
  it('retries invalid output and transient provider failures, and stops on a rejected or rate-limited request', () => {
    expect(classifyLlmFailure(new LlmOutputError('bad'))).toBe('invalid');
    expect(classifyLlmFailure(new ProviderTransportError(null, 'reset'))).toBe('transport');
    expect(classifyLlmFailure(new ProviderTransportError(429, 'slow'))).toBe('fatal');
    expect(classifyLlmFailure(new ProviderTransportError(500, 'down'))).toBe('transport');
    expect(classifyLlmFailure(new ProviderTransportError(502, 'down'))).toBe('transport');
    expect(classifyLlmFailure(new ProviderTransportError(503, 'down'))).toBe('transport');
    expect(classifyLlmFailure(new ProviderTransportError(400, 'bad'))).toBe('fatal');
    expect(classifyLlmFailure(new ProviderTransportError(401, 'auth'))).toBe('fatal');
    expect(classifyLlmFailure(new LlmRouteError(503, 'LLM_NOT_CONFIGURED', 'missing'))).toBe(
      'fatal',
    );
    expect(classifyLlmFailure(new Error('bug'))).toBe('fatal');
  });
});

describe('nextAttemptTimeout', () => {
  it('caps the attempt and returns zero when the budget is spent', () => {
    expect(nextAttemptTimeout(1_000, 1_000, 12_000)).toBe(12_000);
    expect(nextAttemptTimeout(1_000, 16_000, 12_000)).toBe(5_000);
    expect(nextAttemptTimeout(1_000, 21_000, 12_000)).toBe(0);
  });
});

describe('runLlmAttempts', () => {
  it('feeds the validation error into the next attempt and backs off twice', async () => {
    const sleep = vi.fn(async () => undefined);
    const seen: Array<string | null> = [];
    let calls = 0;
    const result = await runLlmAttempts({
      sleep,
      now: () => 0,
      startedAtMs: 0,
      timeoutCapMs: 7_000,
      run: async (feedback, timeoutMs) => {
        calls += 1;
        seen.push(feedback);
        expect(timeoutMs).toBe(7_000);
        if (calls < 3) throw new LlmOutputError('bad json');
        return 'ok';
      },
    });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
    expect(seen).toEqual([null, 'bad json', 'bad json']);
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([200, 800]);
  });

  it('shares the budget between transport and validation failures', async () => {
    const sleep = vi.fn(async () => undefined);
    let calls = 0;
    await expect(
      runLlmAttempts({
        sleep,
        now: () => 0,
        startedAtMs: 0,
        timeoutCapMs: 7_000,
        run: async () => {
          calls += 1;
          if (calls === 1) throw new ProviderTransportError(500, 'down');
          throw new LlmOutputError('still bad');
        },
      }),
    ).rejects.toBeInstanceOf(LlmOutputError);
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('does not retry a fatal provider status', async () => {
    const sleep = vi.fn(async () => undefined);
    let calls = 0;
    await expect(
      runLlmAttempts({
        sleep,
        now: () => 0,
        startedAtMs: 0,
        timeoutCapMs: 7_000,
        run: async () => {
          calls += 1;
          throw new ProviderTransportError(400, 'rejected');
        },
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(calls).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('stops before the next call when the deadline is already spent', async () => {
    const sleep = vi.fn(async () => undefined);
    let clock = 0;
    let calls = 0;
    await expect(
      runLlmAttempts({
        sleep,
        now: () => clock,
        startedAtMs: 0,
        timeoutCapMs: 12_000,
        run: async () => {
          calls += 1;
          clock = 20_000;
          throw new ProviderTransportError(500, 'slow');
        },
      }),
    ).rejects.toBeInstanceOf(ProviderTransportError);
    expect(calls).toBe(1);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
