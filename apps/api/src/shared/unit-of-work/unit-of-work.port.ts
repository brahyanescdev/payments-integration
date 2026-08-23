import type { ResultAsync } from 'neverthrow';

import type { ProductRepository } from '../../modules/catalog/domain/ports/product.repository';
import type {
  CustomerRepository,
  DeliveryRepository,
  StockMovementRepository,
  TransactionRepository,
} from '../../modules/checkout/domain/ports/checkout.repositories';
import type { DomainError } from '../result/domain-error';
import type { WebhookEventRepository } from '../../persistence/webhook-event.repository';

/**
 * The repositories a use case may touch inside one transactional boundary.
 *
 * Handed to the callback rather than injected into the use case, which guarantees
 * every repository in a given piece of work shares the same session — the property
 * that makes a single commit meaningful.
 */
export interface RepositoryRegistry {
  readonly products: ProductRepository;
  readonly transactions: TransactionRepository;
  readonly customers: CustomerRepository;
  readonly deliveries: DeliveryRepository;
  readonly stockMovements: StockMovementRepository;
  readonly webhookEvents: WebhookEventRepository;
}

/**
 * Unit of Work: one commit, or nothing.
 *
 * Reserving stock, creating the customer, recording the delivery and opening the
 * transaction are one business fact. Written separately they can half-succeed and
 * leave inventory decremented for an order that never existed, so they are staged
 * in memory and flushed once, at the end.
 *
 * The contract that matters, and the reason this port exists rather than a bare
 * database transaction: **the unit rolls back when the work returns `Err`, not only
 * when it throws.** Railway Oriented Programming turns business failures into
 * ordinary return values, so a unit that only reacted to exceptions would happily
 * commit the writes staged before an `InsufficientStock` was returned.
 */
export interface UnitOfWork {
  /**
   * Runs `work` inside a single transaction.
   *
   * @param work - Receives repositories bound to this unit's session.
   * @returns The work's own result. `Ok` commits; `Err` rolls back and is passed
   *   through unchanged. Infrastructure failures surface as `Persistence` or
   *   `ConcurrencyConflict` errors.
   */
  run<T>(
    work: (repositories: RepositoryRegistry) => ResultAsync<T, DomainError>,
  ): ResultAsync<T, DomainError>;
}

/** Injection token for {@link UnitOfWork}. */
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
