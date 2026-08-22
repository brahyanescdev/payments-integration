import { type Result } from 'neverthrow';

import { type Money } from '../../../shared/domain/money';
import type { DomainError } from '../../../shared/result/domain-error';

/**
 * What the customer is charged, itemised.
 *
 * The total is derived, never supplied: the API recomputes it server-side and
 * ignores whatever amount the client sends, which is the difference between a
 * checkout and a price the buyer can edit in the browser.
 */
export class AmountBreakdown {
  private constructor(
    readonly productAmount: Money,
    readonly baseFee: Money,
    readonly deliveryFee: Money,
    readonly total: Money,
  ) {}

  static create(
    productAmount: Money,
    baseFee: Money,
    deliveryFee: Money,
  ): Result<AmountBreakdown, DomainError> {
    return productAmount
      .add(baseFee)
      .andThen((subtotal) => subtotal.add(deliveryFee))
      .map((total) => new AmountBreakdown(productAmount, baseFee, deliveryFee, total));
  }

  get currency(): string {
    return this.total.currency;
  }

  equals(other: AmountBreakdown): boolean {
    return (
      this.productAmount.equals(other.productAmount) &&
      this.baseFee.equals(other.baseFee) &&
      this.deliveryFee.equals(other.deliveryFee)
    );
  }
}
