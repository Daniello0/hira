import { Module } from '@nestjs/common';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { CatalogStatsService } from './catalog-stats.service';

/** Counts of the vacancy catalog. `RateLimitModule` carries the shared clock. */
@Module({
  imports: [RateLimitModule],
  providers: [CatalogStatsService],
  exports: [CatalogStatsService],
})
export class CatalogModule {}
