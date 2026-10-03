import { createApiErrorResponse, type ApiErrorResponse } from '@hira/contracts';
import { Controller, Get, HttpException, HttpStatus, Inject, Req } from '@nestjs/common';
import type { Request } from 'express';
import { readRequestId } from '../../common/interceptors/request-id.interceptor';
import { NOT_READY_ERROR_CODE, NOT_READY_MESSAGE } from './health.constants';
import { HealthService, toReadinessResponse } from './health.service';
import type { LivenessResponse, ReadinessReport, ReadinessResponse } from './health.types';

/** `GET /health` and `GET /health/ready`. */
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  /** Process is up. */
  @Get()
  liveness(): LivenessResponse {
    return this.healthService.liveness();
  }

  /** Dependencies are reachable. A miss is HTTP 503. */
  @Get('ready')
  async readiness(@Req() request: Request): Promise<ReadinessResponse> {
    const report = await this.healthService.readiness();
    if (!report.ready) {
      throw new HttpException(notReadyBody(request, report), HttpStatus.SERVICE_UNAVAILABLE);
    }
    return toReadinessResponse(report);
  }
}

function notReadyBody(request: Request, report: ReadinessReport): ApiErrorResponse {
  return createApiErrorResponse(NOT_READY_ERROR_CODE, NOT_READY_MESSAGE, readRequestId(request), {
    checks: report.checks,
  });
}
