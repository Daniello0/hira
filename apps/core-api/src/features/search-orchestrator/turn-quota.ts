import { IntentType, createApiErrorResponse } from '@hira/contracts';
import { RATE_LIMIT_ERROR_CODE } from '../../common/constants/app.constants';
import { QUOTA_EXCEEDED_MESSAGE, SSE_EVENT } from '../chat/chat.constants';
import { QuotaDeniedError } from '../chat/chat.errors';
import type { Caller } from '../chat/resolve-actor';
import type { QuotaConsumption } from '../rate-limit/search-quota';
import type { OrchestratorDeps, QuotaGate, SseSink, Understood } from './turn.types';

/** Dialogue acts that run retrieval. */
export const SEARCHING_INTENTS: ReadonlySet<IntentType> = new Set([IntentType.Search, IntentType.Refine, IntentType.Compare]);

/**
 * Stops a turn before `understand` when the counter is already spent,
 * so an exhausted caller costs no model call. Returns false after writing the error.
 */
export async function precheckQuota(deps: OrchestratorDeps, caller: Caller, sink: SseSink, requestId: string): Promise<boolean> {
  const peeked = await peek(deps.quota, caller);
  if (peeked === null || peeked.allowed) return true;
  sink.write(SSE_EVENT.error, quotaError(peeked.retryAfterSeconds, requestId));
  return false;
}

/**
 * Whether this turn spends one unit.
 * Accounts pay for searches only. Demo pays for every answered turn (3 in total, Wiki/05 §1.6),
 * except a greeting whose intent came from the heuristic because understand failed.
 */
export function isChargeable(caller: Caller, understood: Understood): boolean {
  if (understood.degraded && understood.intent.intentType === IntentType.SmallTalk) return false;
  if (caller.kind === 'demo') return true;
  return SEARCHING_INTENTS.has(understood.intent.intentType);
}

/** Spends the unit when the turn is chargeable. Returns false after writing the error. */
export async function chargeTurn(
  deps: OrchestratorDeps,
  caller: Caller,
  understood: Understood,
  sink: SseSink,
  requestId: string,
): Promise<boolean> {
  if (!isChargeable(caller, understood)) return true;
  const result = await consume(deps, caller);
  if (result.allowed) return true;
  sink.write(SSE_EVENT.error, quotaError(result.retryAfterSeconds, requestId));
  return false;
}

/** Spends one unit or throws `QuotaDeniedError`. Used by the chat-free search. */
export async function consumeOrThrow(deps: OrchestratorDeps, caller: Caller): Promise<void> {
  const result = await consume(deps, caller);
  if (!result.allowed) throw new QuotaDeniedError(result.retryAfterSeconds);
}

function consume(deps: OrchestratorDeps, caller: Caller): Promise<QuotaConsumption> {
  if (caller.kind === 'demo') return deps.quota.consumeDemo(caller.demoSessionId);
  return deps.quota.consumeRegistered(caller.userId);
}

function peek(quota: QuotaGate, caller: Caller): Promise<QuotaConsumption> | null {
  if (caller.kind === 'demo') return quota.peekDemo?.(caller.demoSessionId) ?? null;
  return quota.peekRegistered?.(caller.userId) ?? null;
}

function quotaError(retryAfterSeconds: number | null, requestId: string) {
  return createApiErrorResponse(
    RATE_LIMIT_ERROR_CODE,
    QUOTA_EXCEEDED_MESSAGE,
    requestId,
    retryAfterSeconds === null ? undefined : { retryAfterSeconds },
  );
}
