import { Module } from '@nestjs/common';

import { CatalogModule } from './modules/catalog/catalog.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './modules/health/health.module';
import { PersistenceModule } from './persistence/persistence.module';

/** Root composition module: imports one module per bounded slice of the domain. */
@Module({
  imports: [ConfigModule, PersistenceModule, HealthModule, CatalogModule],
})
export class AppModule {}
