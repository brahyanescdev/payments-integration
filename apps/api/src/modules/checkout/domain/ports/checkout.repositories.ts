import type { ResultAsync } from 'neverthrow';

import type { Email } from '../../../../shared/domain/email';
import type { DomainError } from '../../../../shared/result/domain-error';
import type { Customer } from '../customer';
import type { Delivery } from '../delivery';
import type { StockMovement } from '../stock-movement';
import type { Transaction } from '../transaction';

/** Outbound port for the checkout aggregate root. */
export interface TransactionRepository {
  findById(transactionId: string): ResultAsync<Transaction | null, DomainError>;

  /** Looks a transaction up by the reference sent to the gateway. */
  findByReference(reference: string): ResultAsync<Transaction | null, DomainError>;

  save(transaction: Transaction): ResultAsync<void, DomainError>;
}

export interface CustomerRepository {
  /** Email is the natural key: the same buyer must not become two rows. */
  findByEmail(email: Email): ResultAsync<Customer | null, DomainError>;

  save(customer: Customer): ResultAsync<void, DomainError>;
}

export interface DeliveryRepository {
  findByTransactionId(transactionId: string): ResultAsync<Delivery | null, DomainError>;

  save(delivery: Delivery): ResultAsync<void, DomainError>;
}

/**
 * Append-only inventory ledger.
 *
 * There is no update or delete: the unique constraint on
 * `(transaction_id, type)` is what makes replaying a settlement harmless, so the
 * port deliberately offers no way to rewrite history.
 */
export interface StockMovementRepository {
  /** Reports whether a movement of this kind was already recorded. */
  exists(transactionId: string, type: StockMovement['type']): ResultAsync<boolean, DomainError>;

  append(movement: StockMovement): ResultAsync<void, DomainError>;
}
