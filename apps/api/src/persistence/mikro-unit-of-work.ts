import { OptimisticLockError } from '@mikro-orm/core';
import type { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { err, ok, type Result, ResultAsync } from 'neverthrow';

import { MikroProductRepository } from '../modules/catalog/infrastructure/persistence/mikro-product.repository';
import {
  MikroCustomerRepository,
  MikroDeliveryRepository,
  MikroStockMovementRepository,
  MikroTransactionRepository,
} from '../modules/checkout/infrastructure/persistence/mikro-checkout.repositories';
import { concurrencyConflict, type DomainError, persistence } from '../shared/result/domain-error';
import type { RepositoryRegistry, UnitOfWork } from '../shared/unit-of-work/unit-of-work.port';
import { MikroWebhookEventRepository } from './mikro-webhook-event.repository';

/**
 * Carries a business failure out through the ORM's exception-based rollback.
 *
 * MikroORM decides to commit or roll back by whether the callback throws. Railway
 * Oriented Programming, by design, returns failures instead of throwing — so
 * without this bridge an `Err` would commit everything staged before it. The
 * sentinel is thrown to trigger the rollback and unwrapped immediately outside, so
 * no exception ever escapes into calling code.
 */
class RollbackSignal extends Error {
  constructor(readonly domainError: DomainError) {
    super(`Unit of work rolled back: ${domainError.kind}`);
    this.name = 'RollbackSignal';
  }
}

/** Builds the repositories bound to one unit's session. */
const registryFor = (em: EntityManager): RepositoryRegistry => ({
  products: new MikroProductRepository(em),
  transactions: new MikroTransactionRepository(em),
  customers: new MikroCustomerRepository(em),
  deliveries: new MikroDeliveryRepository(em),
  stockMovements: new MikroStockMovementRepository(em),
  webhookEvents: new MikroWebhookEventRepository(em),
});

/**
 * MikroORM implementation of {@link UnitOfWork}.
 *
 * Every run gets a forked `EntityManager` with its own identity map, so concurrent
 * requests never share staged state. Reserving stock, creating the customer,
 * recording the delivery and opening the transaction accumulate in memory and reach
 * the database in one flush at commit.
 */
export class MikroUnitOfWork implements UnitOfWork {
  constructor(private readonly orm: MikroORM) {}

  run<T>(
    work: (repositories: RepositoryRegistry) => ResultAsync<T, DomainError>,
  ): ResultAsync<T, DomainError> {
    return ResultAsync.fromSafePromise(this.execute(work)).andThen((result) => result);
  }

  private async execute<T>(
    work: (repositories: RepositoryRegistry) => ResultAsync<T, DomainError>,
  ): Promise<Result<T, DomainError>> {
    const em = this.orm.em.fork();

    try {
      const value = await em.transactional(async (tx) => {
        const result = await work(registryFor(tx as EntityManager));

        if (result.isErr()) {
          throw new RollbackSignal(result.error);
        }

        return result.value;
      });

      return ok(value);
    } catch (thrown) {
      return err(this.toDomainError(thrown));
    }
  }

  /**
   * Classifies whatever came out of the transaction.
   *
   * An optimistic lock failure is the expected outcome when two buyers race for the
   * last unit, so it becomes a distinct error the caller can retry on, rather than
   * an opaque persistence failure.
   */
  private toDomainError(thrown: unknown): DomainError {
    if (thrown instanceof RollbackSignal) {
      return thrown.domainError;
    }

    if (thrown instanceof OptimisticLockError) {
      return concurrencyConflict('entity');
    }

    return persistence('unit-of-work');
  }
}
