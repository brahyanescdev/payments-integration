import { err, ok, type Result } from 'neverthrow';

import { type DomainError, validation } from '../result/domain-error';

/**
 * A customer email address, normalised to lowercase.
 *
 * The gateway uses this address to send the payment receipt and treats it as the
 * customer identity, so normalising here prevents the same person turning into two
 * customer rows because of capitalisation.
 */
export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<Email, DomainError> {
    const normalised = raw.trim().toLowerCase();

    // Deliberately permissive: the only address that truly validates is one that
    // receives mail, so this rejects obvious mistakes without turning into an
    // RFC 5322 parser that also rejects valid addresses.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalised)) {
      return err(validation('email', 'is not a valid address'));
    }

    if (normalised.length > 254) {
      return err(validation('email', 'exceeds the 254 character limit'));
    }

    return ok(new Email(normalised));
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
