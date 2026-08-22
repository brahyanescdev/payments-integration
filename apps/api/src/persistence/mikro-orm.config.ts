import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, PostgreSqlDriver, UnderscoreNamingStrategy } from '@mikro-orm/postgresql';

import type { AppConfig } from '../config/app.config';
import { ProductEntity } from '../modules/catalog/infrastructure/persistence/product.entity';
import {
  CustomerEntity,
  DeliveryEntity,
  StockMovementEntity,
  TransactionEntity,
} from '../modules/checkout/infrastructure/persistence/checkout.entities';

/** Every persistence entity, registered explicitly rather than by directory glob. */
export const ENTITIES = [
  ProductEntity,
  CustomerEntity,
  TransactionEntity,
  DeliveryEntity,
  StockMovementEntity,
];

/**
 * Builds the ORM configuration from validated application configuration.
 *
 * Takes {@link AppConfig} as a parameter so tests can point it at a throwaway
 * database without touching the environment.
 */
export function buildMikroOrmConfig(config: AppConfig) {
  return defineConfig({
    // Stated explicitly rather than inferred from the import: `MikroOrmModule
    // .forRootAsync` cannot resolve the driver-specific ORM class from a factory
    // without it, and the failure only appears at Nest bootstrap.
    driver: PostgreSqlDriver,
    clientUrl: config.database.url,
    entities: ENTITIES,
    // Domain code speaks camelCase, PostgreSQL speaks snake_case; the strategy
    // translates so neither has to compromise.
    namingStrategy: UnderscoreNamingStrategy,
    extensions: [Migrator],
    migrations: {
      path: './dist/persistence/migrations',
      pathTs: './src/persistence/migrations',
      // Schema changes are reviewed as code, never applied implicitly at boot.
      disableForeignKeys: false,
      snapshot: false,
    },
    debug: config.nodeEnv === 'development',
    // Every request runs inside a unit of work that forks its own EntityManager, so
    // the global one is only ever used as a factory.
    allowGlobalContext: false,
  });
}
