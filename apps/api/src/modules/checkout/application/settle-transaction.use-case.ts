import { errAsync, okAsync, type ResultAsync } from 'neverthrow';

import type { Clock } from '../../../shared/clock/clock.port';
import type { IdGenerator } from '../../../shared/id/id-generator.port';
import { productNotFound, type DomainError } from '../../../shared/result/domain-error';
import type { RepositoryRegistry } from '../../../shared/unit-of-work/unit-of-work.port';
import { StockMovement } from '../domain/stock-movement';
import type { Transaction, TransactionStatus } from '../domain/transaction';

/** Injection token for {@link SettleTransactionUseCase}. */
export const SETTLE_TRANSACTION_USE_CASE = Symbol('SETTLE_TRANSACTION_USE_CASE');

export interface SettlementOutcome {
  readonly status: Exclude<TransactionStatus, 'PENDING'>;
  readonly failureReason: string | null;
}

/**
 * Applies a gateway's final verdict to a transaction and its stock.
 *
 * Shared by two callers that will never both fire for the same transaction, by
 * construction: the synchronous response to submitting a charge (this vertical
 * slice), and the gateway's webhook when a charge that stayed `PENDING` resolves
 * later (the next one). Both need the exact same rule — approve keeps the stock
 * already reserved and records a `COMMIT` for the audit trail; anything else
 * releases the reservation — so it lives once, called from wherever the verdict
 * actually arrives, rather than duplicated per caller.
 *
 * Runs *inside* an already-open unit of work rather than opening its own: the
 * transition and the stock movement must land in the same commit as whatever
 * else the caller is doing (attaching the card, linking the gateway id).
 */
export class SettleTransactionUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  settle(
    repositories: RepositoryRegistry,
    transaction: Transaction,
    outcome: SettlementOutcome,
  ): ResultAsync<Transaction, DomainError> {
    const now = this.clock.now();

    return transaction
      .settle(outcome.status, now, outcome.failureReason)
      .asyncAndThen(() => repositories.transactions.save(transaction))
      .andThen(() => this.applyStockOutcome(repositories, transaction, outcome.status, now))
      .map(() => transaction);
  }

  /** Approved keeps the stock already decremented at reservation time; anything else returns it. */
  private applyStockOutcome(
    repositories: RepositoryRegistry,
    transaction: Transaction,
    status: SettlementOutcome['status'],
    now: Date,
  ): ResultAsync<void, DomainError> {
    const movementType = status === 'APPROVED' ? 'COMMIT' : 'RELEASE';
    const releaseStock =
      movementType === 'RELEASE'
        ? this.releaseReservedStock(repositories, transaction)
        : okAsync(undefined);

    return releaseStock.andThen(() =>
      repositories.stockMovements.append(
        StockMovement.record({
          id: this.ids.generate(),
          productId: transaction.productId,
          transactionId: transaction.id,
          type: movementType,
          quantity: transaction.quantity,
          now,
        }),
      ),
    );
  }

  /** Returns the reserved units to the shelf after a declined or errored charge. */
  private releaseReservedStock(
    repositories: RepositoryRegistry,
    transaction: Transaction,
  ): ResultAsync<void, DomainError> {
    return repositories.products.findById(transaction.productId).andThen((product) => {
      if (product === null) {
        return errAsync(productNotFound(transaction.productId));
      }

      return product
        .release(transaction.quantity)
        .asyncAndThen(() => repositories.products.save(product));
    });
  }
}
