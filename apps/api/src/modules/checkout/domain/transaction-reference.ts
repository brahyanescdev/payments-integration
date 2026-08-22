import { err, ok, type Result } from 'neverthrow';

import { type DomainError, validation } from '../../../shared/result/domain-error';

/** Gateway limit for the `reference` field. */
const MAX_LENGTH = 255;

const PREFIX = 'TX';

/**
 * The idempotency anchor towards the payment gateway.
 *
 * The gateway rejects a second charge carrying a reference it has already seen, so
 * deriving it from the transaction id — rather than from a timestamp or a counter —
 * means a retry of the same transaction is inherently the same reference and cannot
 * double-charge the customer.
 */
export class TransactionReference {
  private constructor(readonly value: string) {}

  static forTransaction(transactionId: string): Result<TransactionReference, DomainError> {
    return TransactionReference.create(`${PREFIX}-${transactionId}`);
  }

  static create(raw: string): Result<TransactionReference, DomainError> {
    const value = raw.trim();

    if (value.length === 0) {
      return err(validation('reference', 'must not be empty'));
    }

    if (value.length > MAX_LENGTH) {
      return err(validation('reference', `must not exceed ${MAX_LENGTH} characters`));
    }

    // The gateway echoes the reference into receipts and reconciliation exports, so
    // it stays within a conservative, URL- and CSV-safe character set.
    if (!/^[A-Za-z0-9._-]+$/.test(value)) {
      return err(
        validation('reference', 'may only contain letters, digits, dot, dash or underscore'),
      );
    }

    return ok(new TransactionReference(value));
  }

  toString(): string {
    return this.value;
  }
}
