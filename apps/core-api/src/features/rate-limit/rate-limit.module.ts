import { Module } from '@nestjs/common';
import { CLOCK, SystemClock } from '../../common/utils/clock';
import { LoginRateLimitService } from './login-rate-limit.service';
import { SearchQuotaService } from './search-quota.service';

/** Login throttling and the demo / daily search counters. Redis comes from the global module. */
@Module({
  providers: [LoginRateLimitService, SearchQuotaService, { provide: CLOCK, useClass: SystemClock }],
  exports: [LoginRateLimitService, SearchQuotaService, CLOCK],
})
export class RateLimitModule {}
