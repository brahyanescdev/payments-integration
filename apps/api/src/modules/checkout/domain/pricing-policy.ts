import { err, type Result } from 'neverthrow';

import { Money } from '../../../shared/domain/money';
import { type DomainError, invalidQuantity } from '../../../shared/result/domain-error';
import { AmountBreakdown } from './amount-breakdown';

/** Commercial rules, supplied as configuration rather than baked into the code. */
export interface PricingRules {
  readonly currency: string;
  readonly baseFeeInCents: number;
  readonly deliveryFeeInCents: number;
  /** Order value from which delivery is free. */
  readonly freeDeliveryThresholdInCents: number;
}

/**
 * Turns a unit price and a quantity into the amount actually charged.
 *
 * A domain service rather than a method on `Product` because the fees belong to the
 * checkout, not to the catalogue: the same product costs a different total
 * depending on rules the merchant can change without touching the product.
 */
export class PricingPolicy {
  constructor(private readonly rules: PricingRules) {}

  /**
   * @param unitPrice - Price of a single unit.
   * @param quantity - Positive integer number of units; zero is rejected.
   * @returns The itemised breakdown, or a validation error when the price currency
   *   does not match the configured checkout currency.
   */
  quote(unitPrice: Money, quantity: number): Result<AmountBreakdown, DomainError> {
    // `Money.multiply(0)` is legitimate — a zero amount is a real amount — but an
    // order for zero units is not, so the floor belongs here rather than in Money.
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return err(invalidQuantity(quantity));
    }

    return unitPrice
      .multiply(quantity)
      .andThen((productAmount) =>
        Money.create(this.rules.baseFeeInCents, this.rules.currency).andThen((baseFee) =>
          this.deliveryFeeFor(productAmount).andThen((deliveryFee) =>
            AmountBreakdown.create(productAmount, baseFee, deliveryFee),
          ),
        ),
      );
  }

  /** Delivery is waived once the order value reaches the configured threshold. */
  private deliveryFeeFor(productAmount: Money): Result<Money, DomainError> {
    return Money.create(this.rules.freeDeliveryThresholdInCents, this.rules.currency).andThen(
      (threshold) =>
        productAmount.isGreaterThanOrEqualTo(threshold)
          ? Money.zero(this.rules.currency)
          : Money.create(this.rules.deliveryFeeInCents, this.rules.currency),
    );
  }
}
