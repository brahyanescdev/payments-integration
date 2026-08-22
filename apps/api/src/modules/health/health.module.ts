import { Module } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../config/app.config';
import { CLOCK, type Clock, SystemClock } from '../../shared/clock/clock.port';
import { GET_HEALTH_USE_CASE, GetHealthUseCase } from './application/get-health.use-case';
import { HealthController } from './infrastructure/http/health.controller';

/**
 * Wiring for the health slice.
 *
 * Use cases are plain classes with no framework decorators — the module is the
 * only place that knows Nest exists, which is what keeps the application layer
 * portable and trivially unit-testable.
 */
@Module({
  controllers: [HealthController],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    {
      provide: GET_HEALTH_USE_CASE,
      useFactory: (config: AppConfig, clock: Clock) => new GetHealthUseCase(config.version, clock),
      inject: [APP_CONFIG, CLOCK],
    },
  ],
})
export class HealthModule {}
