import { Entity, Enum, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

import { LEGAL_ID_TYPES, type LegalIdType } from '../../domain/customer';
import { DELIVERY_STATUSES, type DeliveryStatus } from '../../domain/delivery';
import { STOCK_MOVEMENT_TYPES, type StockMovementType } from '../../domain/stock-movement';
import { TRANSACTION_STATUSES, type TransactionStatus } from '../../domain/transaction';

@Entity({ tableName: 'customers' })
export class CustomerEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  /** Natural key: the same buyer must never become two rows. */
  @Property({ type: 'string', unique: true, length: 254 })
  email!: string;

  @Property({ type: 'string', length: 160 })
  fullName!: string;

  @Property({ type: 'string', length: 32 })
  phone!: string;

  @Property({ type: 'string', length: 32 })
  legalId!: string;

  @Enum({ items: () => [...LEGAL_ID_TYPES] })
  legalIdType!: LegalIdType;

  @Property({ type: 'Date', onCreate: () => new Date() })
  createdAt!: Date;
}

@Entity({ tableName: 'transactions' })
export class TransactionEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  /**
   * Idempotency anchor towards the gateway. The unique constraint is the last line
   * of defence: even if a retry slipped past the application checks, the database
   * refuses to record a second charge under the same reference.
   */
  @Property({ type: 'string', unique: true, length: 255 })
  reference!: string;

  @Property({ type: 'uuid' })
  customerId!: string;

  @Property({ type: 'uuid' })
  productId!: string;

  @Property({ type: 'integer' })
  quantity!: number;

  @Property({ type: 'integer' })
  productAmountInCents!: number;

  @Property({ type: 'integer' })
  baseFeeInCents!: number;

  @Property({ type: 'integer' })
  deliveryFeeInCents!: number;

  /** Derived from the three amounts above; stored so receipts stay reproducible. */
  @Property({ type: 'integer' })
  amountInCents!: number;

  @Property({ type: 'string', length: 3 })
  currency!: string;

  @Enum({ items: () => [...TRANSACTION_STATUSES] })
  @Index()
  status!: TransactionStatus;

  @Property({ type: 'string', nullable: true, length: 64 })
  gatewayTransactionId!: string | null;

  /** Card brand and last four digits only. The PAN never reaches this system. */
  @Property({ type: 'string', nullable: true, length: 32 })
  cardBrand!: string | null;

  @Property({ type: 'string', nullable: true, length: 4 })
  cardLastFour!: string | null;

  @Property({ nullable: true, type: 'text' })
  failureReason!: string | null;

  @Property({ version: true, type: 'integer' })
  version!: number;

  @Property({ type: 'Date', onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt!: Date;
}

@Entity({ tableName: 'deliveries' })
export class DeliveryEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  /** One delivery per transaction. */
  @Property({ type: 'uuid', unique: true })
  transactionId!: string;

  @Property({ type: 'string', length: 160 })
  recipientName!: string;

  @Property({ type: 'string', length: 32 })
  phone!: string;

  @Property({ type: 'string', length: 200 })
  addressLine1!: string;

  @Property({ type: 'string', nullable: true, length: 200 })
  addressLine2!: string | null;

  @Property({ type: 'string', length: 120 })
  city!: string;

  @Property({ type: 'string', length: 120 })
  region!: string;

  @Property({ type: 'string', length: 2 })
  country!: string;

  @Property({ type: 'string', length: 20 })
  postalCode!: string;

  @Enum({ items: () => [...DELIVERY_STATUSES] })
  status!: DeliveryStatus;

  @Property({ type: 'Date', onCreate: () => new Date() })
  createdAt!: Date;
}

/**
 * Append-only inventory ledger.
 *
 * `UNIQUE (transaction_id, type)` is what makes stock updates idempotent: a replayed
 * webhook cannot record a second COMMIT or RELEASE, so the count cannot drift no
 * matter how many times the gateway retries an event.
 */
@Entity({ tableName: 'stock_movements' })
@Unique({ properties: ['transactionId', 'type'] })
export class StockMovementEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  @Index()
  productId!: string;

  @Property({ type: 'uuid' })
  transactionId!: string;

  @Enum({ items: () => [...STOCK_MOVEMENT_TYPES] })
  type!: StockMovementType;

  @Property({ type: 'integer' })
  quantity!: number;

  @Property({ type: 'Date', onCreate: () => new Date() })
  createdAt!: Date;
}
