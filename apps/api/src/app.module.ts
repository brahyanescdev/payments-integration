import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { APP_CONFIG, type AppConfig } from './config/app.config';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './modules/health/health.module';
import { PersistenceModule } from './persistence/persistence.module';

/** Root composition module: imports one module per bounded slice of the domain. */
@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => [
        {
          ttl: config.reliability.throttleTtlSeconds * 1000,
          limit: config.reliability.throttleLimit,
        },
      ],
    }),
    PersistenceModule,
    HealthModule,
    CatalogModule,
    CheckoutModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
