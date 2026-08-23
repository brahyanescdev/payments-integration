import type { ResultAsync } from 'neverthrow';

import type { DomainError } from '../../../../shared/result/domain-error';

/** Terms the buyer must accept before paying, proxied from the gateway. */
export interface AcceptanceTokens {
  readonly publicKey: string;
  readonly acceptance: { readonly token: string; readonly permalink: string };
  readonly personalDataAuthorization: { readonly token: string; readonly permalink: string };
}

/**
 * Outbound port to the payment service provider (PSP).
 *
 * Only the read-only terms lookup is defined here. Charging a card and verifying
 * a webhook signature depend on the transaction reference and the integrity
 * secret respectively, which belong to the next vertical slice — this port grows
 * to cover them without its existing method changing shape.
 */
export interface PaymentGatewayPort {
  getAcceptanceTokens(): ResultAsync<AcceptanceTokens, DomainError>;
}

/** Injection token for {@link PaymentGatewayPort}. */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
