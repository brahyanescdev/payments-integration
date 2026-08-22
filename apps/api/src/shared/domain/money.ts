import { err, ok, type Result } from 'neverthrow';

import { type DomainError, validation } from '../result/domain-error';

/**
 * A monetary amount, always stored as an integer number of cents.
 *
 * Floating point is never used for money anywhere in this system: `0.1 + 0.2` is
 * not `0.3`, and the payment gateway itself takes `amount_in_cents`, so cents are
 * both the safe and the native representation. The constructor is private —
 * instances only come from {@link Money.create}, which means an invalid amount
 * cannot exist.
 */
export class Money {
  private constructor(
    readonly amountInCents: number,
    readonly currency: string,
  ) {}

  /**
   * @param amountInCents - Non-negative integer amount.
   * @param currency - ISO-4217 alphabetic code, three letters.
   */
  static create(amountInCents: number, currency: string): Result<Money, DomainError> {
    if (!Number.isInteger(amountInCents)) {
      return err(validation('amountInCents', 'must be an integer number of cents'));
    }

    if (amountInCents < 0) {
      return err(validation('amountInCents', 'must not be negative'));
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      return err(validation('currency', 'must be a three-letter ISO-4217 code'));
    }

    return ok(new Money(amountInCents, currency));
  }

  static zero(currency: string): Result<Money, DomainError> {
    return Money.create(0, currency);
  }

  /** @returns The sum, or a validation error when the currencies differ. */
  add(other: Money): Result<Money, DomainError> {
    if (other.currency !== this.currency) {
      return err(validation('currency', `cannot add ${other.currency} to ${this.currency}`));
    }

    return Money.create(this.amountInCents + other.amountInCents, this.currency);
  }

  /** @param factor - Non-negative integer, typically an item quantity. */
  multiply(factor: number): Result<Money, DomainError> {
    if (!Number.isInteger(factor) || factor < 0) {
      return err(validation('factor', 'must be a non-negative integer'));
    }

    return Money.create(this.amountInCents * factor, this.currency);
  }

  isGreaterThanOrEqualTo(other: Money): boolean {
    return this.currency === other.currency && this.amountInCents >= other.amountInCents;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountInCents === other.amountInCents;
  }

  toString(): string {
    return `${this.amountInCents} ${this.currency}`;
  }
}
