import type { ResultAsync } from 'neverthrow';

import type { TransactionStatus } from '../../../checkout/domain/transaction';
import type { DomainError } from '../../../../shared/result/domain-error';

/** Terms the buyer must accept before paying, proxied from the gateway. */
export interface AcceptanceTokens {
  readonly publicKey: string;
  /**
   * Where the browser tokenises a card directly — never through our backend.
   * An absolute URL for the real gateway; for the fake driver, a path relative
   * to our own API that the frontend resolves against its configured base URL,
   * so local development and CI need no real network access to produce a token.
   */
  readonly tokenizationUrl: string;
  readonly acceptance: { readonly token: string; readonly permalink: string };
  readonly personalDataAuthorization: { readonly token: string; readonly permalink: string };
}

export interface ChargeCardInput {
  readonly reference: string;
  readonly amountInCents: number;
  readonly currency: string;
  readonly customerEmail: string;
  readonly cardToken: string;
  readonly acceptanceToken: string;
  readonly acceptPersonalAuthToken: string;
  readonly installments: number;
}

export interface ChargeResult {
  readonly gatewayTransactionId: string;
  /**
   * Whatever the gateway reports at the moment of submission. Card charges
   * settle asynchronously, so this is very often still `PENDING` — the
   * transaction only reaches a terminal status here when the gateway happens to
   * resolve it inline. Anything left `PENDING` is settled later, by the same
   * settlement logic a webhook or a status poll drives.
   */
  readonly status: TransactionStatus;
  readonly failureReason: string | null;
}

/**
 * Outbound port to the payment service provider (PSP).
 */
export interface PaymentGatewayPort {
  getAcceptanceTokens(): ResultAsync<AcceptanceTokens, DomainError>;
  chargeCard(input: ChargeCardInput): ResultAsync<ChargeResult, DomainError>;
}

/** Injection token for {@link PaymentGatewayPort}. */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
