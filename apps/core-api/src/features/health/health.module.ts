import { Module } from '@nestjs/common';
import { buildCoreApiProbes } from './build-probes';
import { HEALTH_PROBES } from './health.constants';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/** Health routes and the probes they consult. */
@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: HEALTH_PROBES,
      useFactory: (): ReturnType<typeof buildCoreApiProbes> => buildCoreApiProbes(process.env),
    },
  ],
})
export class HealthModule {}
