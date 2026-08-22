import { err, ok, type Result } from 'neverthrow';

import { type DomainError, transactionNotPending } from '../../../shared/result/domain-error';
import type { AmountBreakdown } from './amount-breakdown';

/**
 * Lifecycle of a payment, mirroring the states the gateway reports.
 *
 * Every transaction starts `PENDING`; the other four are terminal. Payment is
 * asynchronous, so the final state arrives either from polling or from a webhook.
 */
export const TRANSACTION_STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** Card metadata safe to persist. The PAN and CVC never reach this system. */
export interface CardFingerprint {
  readonly brand: string;
  readonly lastFour: string;
}

export interface TransactionSnapshot {
  readonly id: string;
  readonly reference: string;
  readonly customerId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly breakdown: AmountBreakdown;
  readonly status: TransactionStatus;
  readonly gatewayTransactionId: string | null;
  readonly card: CardFingerprint | null;
  readonly failureReason: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Aggregate root of the checkout.
 *
 * State transitions are one-way and only ever leave `PENDING`. That single rule is
 * what makes the gateway webhook safe to receive twice: the gateway retries an
 * event up to three times over 24 hours, and a duplicate — or an event that arrives
 * after polling already settled the transaction — must not flip an `APPROVED`
 * payment back into anything else.
 */
export class Transaction {
  private constructor(
    readonly id: string,
    readonly reference: string,
    readonly customerId: string,
    readonly productId: string,
    readonly quantity: number,
    readonly breakdown: AmountBreakdown,
    private currentStatus: TransactionStatus,
    private currentGatewayTransactionId: string | null,
    private currentCard: CardFingerprint | null,
    private currentFailureReason: string | null,
    readonly version: number,
    readonly createdAt: Date,
    private currentUpdatedAt: Date,
  ) {}

  /** Opens a transaction in `PENDING`, before the gateway is contacted. */
  static open(input: {
    id: string;
    reference: string;
    customerId: string;
    productId: string;
    quantity: number;
    breakdown: AmountBreakdown;
    now: Date;
  }): Transaction {
    return new Transaction(
      input.id,
      input.reference,
      input.customerId,
      input.productId,
      input.quantity,
      input.breakdown,
      'PENDING',
      null,
      null,
      null,
      1,
      input.now,
      input.now,
    );
  }

  static rehydrate(snapshot: TransactionSnapshot): Transaction {
    return new Transaction(
      snapshot.id,
      snapshot.reference,
      snapshot.customerId,
      snapshot.productId,
      snapshot.quantity,
      snapshot.breakdown,
      snapshot.status,
      snapshot.gatewayTransactionId,
      snapshot.card,
      snapshot.failureReason,
      snapshot.version,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get status(): TransactionStatus {
    return this.currentStatus;
  }

  get gatewayTransactionId(): string | null {
    return this.currentGatewayTransactionId;
  }

  get card(): CardFingerprint | null {
    return this.currentCard;
  }

  get failureReason(): string | null {
    return this.currentFailureReason;
  }

  get isPending(): boolean {
    return this.currentStatus === 'PENDING';
  }

  get isFinal(): boolean {
    return !this.isPending;
  }

  /** Records which card paid, without ever storing the card itself. */
  attachCard(card: CardFingerprint, now: Date): Result<void, DomainError> {
    return this.whilePending(() => {
      this.currentCard = card;
      this.currentUpdatedAt = now;
    });
  }

  /** Links the gateway's own identifier once the charge has been submitted. */
  linkToGateway(gatewayTransactionId: string, now: Date): Result<void, DomainError> {
    return this.whilePending(() => {
      this.currentGatewayTransactionId = gatewayTransactionId;
      this.currentUpdatedAt = now;
    });
  }

  /**
   * Applies the gateway's verdict.
   *
   * @param status - Any terminal status reported by the gateway.
   * @param now - Instant of the transition, from the injected clock.
   * @param failureReason - Gateway explanation, for anything but `APPROVED`.
   * @returns `TransactionNotPending` when the transaction has already settled, which
   *   is the expected outcome for a duplicate webhook rather than a bug.
   */
  settle(
    status: Exclude<TransactionStatus, 'PENDING'>,
    now: Date,
    failureReason: string | null = null,
  ): Result<void, DomainError> {
    return this.whilePending(() => {
      this.currentStatus = status;
      this.currentFailureReason = status === 'APPROVED' ? null : failureReason;
      this.currentUpdatedAt = now;
    });
  }

  toSnapshot(): TransactionSnapshot {
    return {
      id: this.id,
      reference: this.reference,
      customerId: this.customerId,
      productId: this.productId,
      quantity: this.quantity,
      breakdown: this.breakdown,
      status: this.currentStatus,
      gatewayTransactionId: this.currentGatewayTransactionId,
      card: this.currentCard,
      failureReason: this.currentFailureReason,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.currentUpdatedAt,
    };
  }

  /** Guards every mutation behind the single "only while pending" rule. */
  private whilePending(mutate: () => void): Result<void, DomainError> {
    if (this.isFinal) {
      return err(transactionNotPending(this.id, this.currentStatus));
    }

    mutate();

    return ok(undefined);
  }
}
