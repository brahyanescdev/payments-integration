import { okAsync, type ResultAsync } from 'neverthrow';

import type { DomainError } from '../../../../shared/result/domain-error';
import type { AcceptanceTokens, PaymentGatewayPort } from '../../domain/ports/payment-gateway.port';

/**
 * Deterministic double for the payment gateway.
 *
 * Selected by `PAYMENT_GATEWAY_DRIVER=fake`, which is CI's default and the only
 * safe choice for automated runs: the real sandbox account is shared across every
 * candidate taking this test, and its session can be closed from another location
 * at any moment, which would fail the pipeline for a reason that has nothing to do
 * with the code under review.
 */
export class FakePaymentGatewayAdapter implements PaymentGatewayPort {
  getAcceptanceTokens(): ResultAsync<AcceptanceTokens, DomainError> {
    return okAsync({
      publicKey: 'pub_test_fake00000000000000000000',
      acceptance: {
        token: 'fake_acceptance_token',
        permalink: 'https://example.test/terms',
      },
      personalDataAuthorization: {
        token: 'fake_personal_data_token',
        permalink: 'https://example.test/privacy',
      },
    });
  }
}
