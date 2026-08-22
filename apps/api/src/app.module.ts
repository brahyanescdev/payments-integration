import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { HealthModule } from './modules/health/health.module';

/** Root composition module: imports one module per bounded slice of the domain. */
@Module({
  imports: [ConfigModule, HealthModule],
})
export class AppModule {}
