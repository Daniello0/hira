import { NextResponse } from 'next/server';
import { liveness } from '../../features/health/health.service';
import { REQUEST_ID_HEADER } from '../../features/health/health.constants';
import { resolveRequestId } from '../../features/health/request-id';

/** `GET /health` — the Next.js process is up. */
export function GET(request: Request): NextResponse {
  const requestId = resolveRequestId(request);
  const response = NextResponse.json(liveness());
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}
