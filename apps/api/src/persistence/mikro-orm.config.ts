import { join } from 'node:path';

import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, PostgreSqlDriver, UnderscoreNamingStrategy } from '@mikro-orm/postgresql';

import { ProductEntity } from '../modules/catalog/infrastructure/persistence/product.entity';
import {
  CustomerEntity,
  DeliveryEntity,
  StockMovementEntity,
  TransactionEntity,
} from '../modules/checkout/infrastructure/persistence/checkout.entities';
import { IdempotencyKeyEntity } from './idempotency-key.entity';
import type { MikroOrmSettings } from './orm-settings';
import { WebhookEventEntity } from './webhook-event.entity';

/** Migration folder, sibling of this module in both `src` and `dist`. */
const MIGRATIONS_DIR = join(__dirname, 'migrations');

/** Every persistence entity, registered explicitly rather than by directory glob. */
export const ENTITIES = [
  ProductEntity,
  CustomerEntity,
  TransactionEntity,
  DeliveryEntity,
  StockMovementEntity,
  IdempotencyKeyEntity,
  WebhookEventEntity,
];

/**
 * Builds the ORM configuration.
 *
 * Takes {@link MikroOrmSettings} rather than the full application configuration so
 * that migrations, the seeder and the tests can run knowing only where the database
 * is — see `orm-settings.ts` for why that distinction matters.
 */
export function buildMikroOrmConfig(settings: MikroOrmSettings) {
  return defineConfig({
    // Stated explicitly rather than inferred from the import: `MikroOrmModule
    // .forRootAsync` cannot resolve the driver-specific ORM class from a factory
    // without it, and the failure only appears at Nest bootstrap.
    driver: PostgreSqlDriver,
    clientUrl: settings.databaseUrl,
    entities: ENTITIES,
    // Domain code speaks camelCase, PostgreSQL speaks snake_case; the strategy
    // translates so neither has to compromise.
    namingStrategy: UnderscoreNamingStrategy,
    extensions: [Migrator],
    migrations: {
      // Resolved from this module's own location, not from the working directory.
      // Relative paths made the migrator silently find nothing whenever the process
      // was started from elsewhere — and "no migrations" looks exactly like success.
      // The folder sits next to this file in both the sources and the build output,
      // so one absolute path is correct for either.
      path: MIGRATIONS_DIR,
      pathTs: MIGRATIONS_DIR,
      // Schema changes are reviewed as code, never applied implicitly at boot.
      disableForeignKeys: false,
      snapshot: false,
    },
    debug: settings.debug,
    // Every request runs inside a unit of work that forks its own EntityManager, so
    // the global one is only ever used as a factory.
    allowGlobalContext: false,
  });
}
