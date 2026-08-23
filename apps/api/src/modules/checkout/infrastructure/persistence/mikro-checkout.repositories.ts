import type { EntityManager } from '@mikro-orm/postgresql';
import { ok, okAsync, type Result, ResultAsync } from 'neverthrow';

import type { Email } from '../../../../shared/domain/email';
import { type DomainError, persistence } from '../../../../shared/result/domain-error';
import type { Customer } from '../../domain/customer';
import type { Delivery } from '../../domain/delivery';
import type {
  CustomerRepository,
  DeliveryRepository,
  StockMovementRepository,
  TransactionRepository,
} from '../../domain/ports/checkout.repositories';
import type { StockMovement } from '../../domain/stock-movement';
import type { Transaction } from '../../domain/transaction';
import {
  CustomerEntity,
  DeliveryEntity,
  StockMovementEntity,
  TransactionEntity,
} from './checkout.entities';
import {
  customerMapper,
  deliveryMapper,
  stockMovementMapper,
  transactionMapper,
} from './checkout.mappers';

/** Turns a thrown driver error into a `Persistence` value, keeping the rails intact. */
const query = <T>(operation: string, run: () => Promise<T>): ResultAsync<T, DomainError> =>
  ResultAsync.fromPromise(run(), () => persistence(operation));

export class MikroTransactionRepository implements TransactionRepository {
  private readonly rowsById = new Map<string, TransactionEntity>();

  constructor(private readonly em: EntityManager) {}

  findById(transactionId: string): ResultAsync<Transaction | null, DomainError> {
    return query('transactions.findById', () =>
      this.em.findOne(TransactionEntity, { id: transactionId }),
    ).andThen((row) => (row === null ? ok(null) : this.track(row)));
  }

  findByReference(reference: string): ResultAsync<Transaction | null, DomainError> {
    return query('transactions.findByReference', () =>
      this.em.findOne(TransactionEntity, { reference }),
    ).andThen((row) => (row === null ? ok(null) : this.track(row)));
  }

  save(transaction: Transaction): ResultAsync<void, DomainError> {
    const tracked = this.rowsById.get(transaction.id);

    if (tracked !== undefined) {
      transactionMapper.applyToRow(transaction, tracked);

      return okAsync(undefined);
    }

    const row = transactionMapper.toNewRow(transaction);
    this.em.persist(row);
    this.rowsById.set(transaction.id, row);

    return okAsync(undefined);
  }

  private track(row: TransactionEntity): Result<Transaction, DomainError> {
    return transactionMapper.toDomain(row).map((transaction) => {
      this.rowsById.set(transaction.id, row);

      return transaction;
    });
  }
}

export class MikroCustomerRepository implements CustomerRepository {
  private readonly rowsById = new Map<string, CustomerEntity>();

  constructor(private readonly em: EntityManager) {}

  findByEmail(email: Email): ResultAsync<Customer | null, DomainError> {
    return query('customers.findByEmail', () =>
      this.em.findOne(CustomerEntity, { email: email.value }),
    ).andThen((row) => (row === null ? ok(null) : this.track(row)));
  }

  findById(customerId: string): ResultAsync<Customer | null, DomainError> {
    return query('customers.findById', () =>
      this.em.findOne(CustomerEntity, { id: customerId }),
    ).andThen((row) => (row === null ? ok(null) : this.track(row)));
  }

  save(customer: Customer): ResultAsync<void, DomainError> {
    const tracked = this.rowsById.get(customer.id);

    if (tracked !== undefined) {
      customerMapper.applyToRow(customer, tracked);

      return okAsync(undefined);
    }

    const row = customerMapper.toNewRow(customer);
    this.em.persist(row);
    this.rowsById.set(customer.id, row);

    return okAsync(undefined);
  }

  private track(row: CustomerEntity): Result<Customer, DomainError> {
    return customerMapper.toDomain(row).map((customer) => {
      this.rowsById.set(customer.id, row);

      return customer;
    });
  }
}

export class MikroDeliveryRepository implements DeliveryRepository {
  private readonly rowsById = new Map<string, DeliveryEntity>();

  constructor(private readonly em: EntityManager) {}

  findByTransactionId(transactionId: string): ResultAsync<Delivery | null, DomainError> {
    return query('deliveries.findByTransactionId', () =>
      this.em.findOne(DeliveryEntity, { transactionId }),
    ).map((row) => {
      if (row === null) return null;

      const delivery = deliveryMapper.toDomain(row);
      this.rowsById.set(delivery.id, row);

      return delivery;
    });
  }

  save(delivery: Delivery): ResultAsync<void, DomainError> {
    const tracked = this.rowsById.get(delivery.id);

    if (tracked !== undefined) {
      deliveryMapper.applyToRow(delivery, tracked);

      return okAsync(undefined);
    }

    const row = deliveryMapper.toNewRow(delivery);
    this.em.persist(row);
    this.rowsById.set(delivery.id, row);

    return okAsync(undefined);
  }
}

/**
 * Append-only ledger adapter.
 *
 * There is no `save`, only `append`: rewriting an inventory movement would destroy
 * the audit trail that explains how the current stock was reached.
 */
export class MikroStockMovementRepository implements StockMovementRepository {
  constructor(private readonly em: EntityManager) {}

  exists(transactionId: string, type: StockMovement['type']): ResultAsync<boolean, DomainError> {
    return query('stockMovements.exists', () =>
      this.em.count(StockMovementEntity, { transactionId, type }),
    ).map((count) => count > 0);
  }

  append(movement: StockMovement): ResultAsync<void, DomainError> {
    this.em.persist(stockMovementMapper.toNewRow(movement));

    return okAsync(undefined);
  }
}
