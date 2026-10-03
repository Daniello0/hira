import { createApiErrorResponse } from '@hira/contracts';
import { NextResponse } from 'next/server';
import {
  NOT_READY_ERROR_CODE,
  NOT_READY_MESSAGE,
  REQUEST_ID_HEADER,
} from '../../../features/health/health.constants';
import {
  buildWebProbes,
  collectReadiness,
  toReadinessResponse,
} from '../../../features/health/health.service';
import { resolveRequestId } from '../../../features/health/request-id';
import type { ReadinessReport } from '../../../features/health/health.types';

/** `GET /health/ready` — core-api readiness must answer. */
export async function GET(request: Request): Promise<NextResponse> {
  const requestId = resolveRequestId(request);
  const report = await collectReadiness(buildWebProbes(process.env));
  if (!report.ready) {
    return notReady(requestId, report);
  }
  return jsonWithRequestId(toReadinessResponse(report), 200, requestId);
}

function notReady(requestId: string, report: ReadinessReport): NextResponse {
  const body = createApiErrorResponse(NOT_READY_ERROR_CODE, NOT_READY_MESSAGE, requestId, {
    checks: report.checks,
  });
  return jsonWithRequestId(body, 503, requestId);
}

function jsonWithRequestId(body: unknown, status: number, requestId: string): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}
