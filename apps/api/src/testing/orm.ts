import { MikroORM } from '@mikro-orm/postgresql';

import { ProductEntity } from '../modules/catalog/infrastructure/persistence/product.entity';
import {
  CustomerEntity,
  DeliveryEntity,
  StockMovementEntity,
  TransactionEntity,
} from '../modules/checkout/infrastructure/persistence/checkout.entities';
import { buildMikroOrmConfig } from '../persistence/mikro-orm.config';
import { loadOrmSettings } from '../persistence/orm-settings';

/**
 * Opens an ORM instance against the integration-test database.
 *
 * Reads `DATABASE_URL` when present — CI provides one through a Postgres service
 * container — and otherwise falls back to the local `docker compose` stack, so
 * `pnpm db:up && pnpm test` works with no further setup.
 *
 * The schema is prepared once by `jest.global-setup.ts`, so this only opens a
 * connection — migrating here would race between parallel Jest workers.
 */
export async function openTestOrm() {
  const settings = loadOrmSettings({
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ?? 'postgresql://payments:payments@localhost:5432/payments',
    NODE_ENV: 'test',
  });

  // NODE_ENV is pinned to `test`, so the builder keeps query logging off.
  return MikroORM.init(buildMikroOrmConfig(settings));
}

/**
 * Removes everything a checkout-flow integration test left behind, scoped to the
 * one product it used.
 *
 * Deliberately does *not* blanket-delete `customers` or `deliveries`: Jest runs
 * integration spec files in parallel worker processes against this same
 * database, so an unscoped `nativeDelete` in one file's `afterEach` can erase
 * rows another file's concurrently-running test still needs — surfacing as a
 * flaky, unrelated-looking `TransactionNotFound` in whichever test lost the
 * race. Every table here is cleared through the one `productId` this test
 * actually owns instead. `webhook_events` has no such column and is not touched
 * here for the same reason — a caller that writes to it must clean up its own
 * rows, scoped by the checksums it actually created.
 *
 * Deletes go through the registered entity classes, not raw table names:
 * MikroORM needs an entity's metadata to build a `$in` condition, and silently
 * fails with an unrelated `TypeError` when given a bare table-name string
 * instead.
 */
export async function cleanupCheckoutFixtures(orm: MikroORM, productId: string): Promise<void> {
  const em = orm.em.fork();
  const transactions = await em.find(TransactionEntity, { productId });
  const transactionIds = transactions.map((transaction) => transaction.id);
  const customerIds = transactions.map((transaction) => transaction.customerId);

  await em.nativeDelete(StockMovementEntity, { productId });

  if (transactionIds.length > 0) {
    await em.nativeDelete(DeliveryEntity, { transactionId: { $in: transactionIds } });
  }

  await em.nativeDelete(TransactionEntity, { productId });

  if (customerIds.length > 0) {
    await em.nativeDelete(CustomerEntity, { id: { $in: customerIds } });
  }

  await em.nativeDelete(ProductEntity, { id: productId });
}
