import { err, ok, type Result } from 'neverthrow';

import { type DomainError, validation } from '../../../shared/result/domain-error';

/**
 * Fulfilment states.
 *
 * `PENDING` while the payment is in flight, `ASSIGNED` once it is approved and the
 * units are committed to this buyer, `CANCELLED` when the payment fails and the
 * stock goes back to the shelf.
 */
export const DELIVERY_STATUSES = ['PENDING', 'ASSIGNED', 'CANCELLED'] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface Address {
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly region: string;
  readonly country: string;
  readonly postalCode: string;
}

export interface DeliverySnapshot {
  readonly id: string;
  readonly transactionId: string;
  readonly recipientName: string;
  readonly phone: string;
  readonly address: Address;
  readonly status: DeliveryStatus;
  readonly createdAt: Date;
}

/** Where an approved order is shipped, and whether it has been committed to. */
export class Delivery {
  private constructor(
    readonly id: string,
    readonly transactionId: string,
    readonly recipientName: string,
    readonly phone: string,
    readonly address: Address,
    private currentStatus: DeliveryStatus,
    readonly createdAt: Date,
  ) {}

  static open(input: {
    id: string;
    transactionId: string;
    recipientName: string;
    phone: string;
    address: Address;
    now: Date;
  }): Result<Delivery, DomainError> {
    if (input.recipientName.trim().length === 0) {
      return err(validation('recipientName', 'must not be empty'));
    }

    if (input.address.line1.trim().length === 0) {
      return err(validation('address.line1', 'must not be empty'));
    }

    if (input.address.city.trim().length === 0) {
      return err(validation('address.city', 'must not be empty'));
    }

    return ok(
      new Delivery(
        input.id,
        input.transactionId,
        input.recipientName.trim(),
        input.phone.trim(),
        input.address,
        'PENDING',
        input.now,
      ),
    );
  }

  static rehydrate(snapshot: DeliverySnapshot): Delivery {
    return new Delivery(
      snapshot.id,
      snapshot.transactionId,
      snapshot.recipientName,
      snapshot.phone,
      snapshot.address,
      snapshot.status,
      snapshot.createdAt,
    );
  }

  get status(): DeliveryStatus {
    return this.currentStatus;
  }

  /** Commits the goods to this buyer, once the payment is approved. */
  assign(): Result<void, DomainError> {
    return this.transitionFromPending('ASSIGNED');
  }

  /** Stands the order down after a declined or failed payment. */
  cancel(): Result<void, DomainError> {
    return this.transitionFromPending('CANCELLED');
  }

  toSnapshot(): DeliverySnapshot {
    return {
      id: this.id,
      transactionId: this.transactionId,
      recipientName: this.recipientName,
      phone: this.phone,
      address: this.address,
      status: this.currentStatus,
      createdAt: this.createdAt,
    };
  }

  /** Mirrors the transaction rule: a settled delivery never changes again. */
  private transitionFromPending(next: DeliveryStatus): Result<void, DomainError> {
    if (this.currentStatus !== 'PENDING') {
      return err(validation('delivery.status', `is already ${this.currentStatus}`));
    }

    this.currentStatus = next;

    return ok(undefined);
  }
}
