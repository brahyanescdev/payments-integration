import type { Email } from '../../../shared/domain/email';

/** Government identification types accepted in Colombia. */
export const LEGAL_ID_TYPES = ['CC', 'CE', 'NIT', 'PP'] as const;

export type LegalIdType = (typeof LEGAL_ID_TYPES)[number];

export interface CustomerSnapshot {
  readonly id: string;
  readonly email: Email;
  readonly fullName: string;
  readonly phone: string;
  readonly legalId: string;
  readonly legalIdType: LegalIdType;
  readonly createdAt: Date;
}

/**
 * The buyer.
 *
 * Identified by email, which is what the gateway keys receipts on. Deliberately
 * anaemic: a customer has no behaviour in this checkout beyond being addressable,
 * and inventing methods for it would be ceremony rather than modelling.
 */
export class Customer {
  private constructor(
    readonly id: string,
    readonly email: Email,
    readonly fullName: string,
    readonly phone: string,
    readonly legalId: string,
    readonly legalIdType: LegalIdType,
    readonly createdAt: Date,
  ) {}

  static rehydrate(snapshot: CustomerSnapshot): Customer {
    return new Customer(
      snapshot.id,
      snapshot.email,
      snapshot.fullName,
      snapshot.phone,
      snapshot.legalId,
      snapshot.legalIdType,
      snapshot.createdAt,
    );
  }

  toSnapshot(): CustomerSnapshot {
    return {
      id: this.id,
      email: this.email,
      fullName: this.fullName,
      phone: this.phone,
      legalId: this.legalId,
      legalIdType: this.legalIdType,
      createdAt: this.createdAt,
    };
  }
}
